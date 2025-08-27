import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import http from 'http';
import axios from 'axios';
const { Client, LocalAuth } = pkg;

// Configuración del bot
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Configuración de APIs
const config = {
    odoo: {
        baseUrl: process.env.ODOO_URL || 'https://toys-toysvip-22621490.dev.odoo.com',
        apiKey: process.env.ODOO_API_KEY || 'a655e100b60f71ae4d00f74f879532515caf5cf1',
        database: process.env.ODOO_DB || 'toys-toysvip-22621490'
    },
    meta: {
        accessToken: process.env.META_ACCESS_TOKEN || 'tu-meta-token',
        appId: process.env.META_APP_ID || 'tu-app-id'   
    }
};

// Cache de productos de Odoo (se actualiza cada 30 minutos)
let productsCache = [];
let lastProductsUpdate = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

// Promociones actuales (también se obtienen de Odoo)
let promotionsCache = [];
let lastPromotionsUpdate = 0;

// Almacenamiento de usuarios y contexto
const userData = new Map();
const userContext = new Map();
const adContext = new Map(); // Para almacenar contexto de ads

// Función para detectar origen del mensaje
function detectMessageOrigin(message) {
    // Verificar si viene de un ad de Facebook/Instagram
    if (message.from.includes('@c.us')) {
        // Verificar si hay contexto de ad almacenado
        const userId = message.from;
        if (adContext.has(userId)) {
            return {
                origin: 'ad',
                platform: adContext.get(userId).platform,
                productId: adContext.get(userId).productId,
                productName: adContext.get(userId).productName
            };
        }
        
        // Verificar si hay parámetros de tracking en el mensaje
        if (message.body.includes('fb_ad') || message.body.includes('ig_ad')) {
            return { origin: 'ad', platform: 'unknown' };
        }
    }
    
    return { origin: 'general', platform: null };
}

// Función para consultar Odoo
async function queryOdoo(endpoint, data = {}) {
    try {
        const response = await axios.post(`${config.odoo.baseUrl}/api/${endpoint}`, {
            ...data,
            api_key: config.odoo.apiKey,
            database: config.odoo.database
        });
        return response.data;
    } catch (error) {
        console.error('Error consultando Odoo:', error.message);
        return null;
    }
}

// Función para obtener productos desde Odoo
async function getProductsFromOdoo() {
    try {
        const now = Date.now();
        
        // Si el cache está vigente, usar productos en cache
        if (productsCache.length > 0 && (now - lastProductsUpdate) < CACHE_DURATION) {
            return productsCache;
        }
        
        console.log('🔄 Actualizando catálogo de productos desde Odoo...');
        
        const products = await queryOdoo('products/list', {
            include_stock: true,
            include_categories: true,
            include_descriptions: true
        });
        
        if (products && products.success) {
            productsCache = products.data.map(product => ({
                id: product.id,
                name: product.name,
                price: product.price,
                category: product.category,
                stock: product.stock || 0,
                description: product.description || '',
                age_range: product.age_range || '',
                brand: product.brand || '',
                colors: product.colors || [],
                features: product.features || []
            }));
            
            lastProductsUpdate = now;
            console.log(`✅ Catálogo actualizado: ${productsCache.length} productos`);
            return productsCache;
        } else {
            console.error('❌ Error obteniendo productos de Odoo:', products);
            // Si hay error, devolver cache anterior si existe
            return productsCache.length > 0 ? productsCache : [];
        }
    } catch (error) {
        console.error('❌ Error en getProductsFromOdoo:', error.message);
        // Si hay error, devolver cache anterior si existe
        return productsCache.length > 0 ? productsCache : [];
    }
}

// Función para obtener promociones desde Odoo
async function getPromotionsFromOdoo() {
    try {
        const now = Date.now();
        
        // Si el cache está vigente, usar promociones en cache
        if (promotionsCache.length > 0 && (now - lastPromotionsUpdate) < CACHE_DURATION) {
            return promotionsCache;
        }
        
        console.log('🔄 Actualizando promociones desde Odoo...');
        
        const promotions = await queryOdoo('promotions/list', {
            active_only: true,
            include_details: true
        });
        
        if (promotions && promotions.success) {
            promotionsCache = promotions.data.map(promo => ({
                id: promo.id,
                title: promo.title,
                description: promo.description,
                discount: promo.discount,
                valid_until: promo.valid_until,
                categories: promo.categories || [],
                products: promo.products || []
            }));
            
            lastPromotionsUpdate = now;
            console.log(`✅ Promociones actualizadas: ${promotionsCache.length} promociones`);
            return promotionsCache;
        } else {
            console.error('❌ Error obteniendo promociones de Odoo:', promotions);
            // Si hay error, devolver cache anterior si existe
            return promotionsCache.length > 0 ? promotionsCache : [];
        }
    } catch (error) {
        console.error('❌ Error en getPromotionsFromOdoo:', error.message);
        // Si hay error, devolver cache anterior si existe
        return promotionsCache.length > 0 ? promotionsCache : [];
    }
}

// Función para obtener historial del cliente en Odoo
async function getCustomerHistory(phoneNumber) {
    const history = await queryOdoo('customer/history', { phone: phoneNumber });
    return history;
}

// Función para registrar interacción en Odoo
async function logInteraction(phoneNumber, interaction, origin) {
    await queryOdoo('interaction/log', {
        phone: phoneNumber,
        interaction: interaction,
        origin: origin,
        timestamp: new Date().toISOString()
    });
}

// Función para buscar productos por criterios
async function searchProducts(criteria) {
    const products = await getProductsFromOdoo();
    
    if (!products || products.length === 0) {
        return [];
    }
    
    const searchTerm = criteria.toLowerCase();
    
    return products.filter(product => {
        // Búsqueda por nombre
        if (product.name.toLowerCase().includes(searchTerm)) return true;
        
        // Búsqueda por categoría
        if (product.category && product.category.toLowerCase().includes(searchTerm)) return true;
        
        // Búsqueda por marca
        if (product.brand && product.brand.toLowerCase().includes(searchTerm)) return true;
        
        // Búsqueda por características
        if (product.features && product.features.some(f => f.toLowerCase().includes(searchTerm))) return true;
        
        return false;
    });
}

// Función para obtener productos por categoría
async function getProductsByCategory(category) {
    const products = await getProductsFromOdoo();
    
    if (!products || products.length === 0) {
        return [];
    }
    
    const categoryLower = category.toLowerCase();
    
    return products.filter(product => {
        if (product.category && product.category.toLowerCase().includes(categoryLower)) return true;
        
        // Búsqueda por palabras clave de categoría
        const categoryKeywords = {
            'lego': ['construcción', 'bloques', 'lego'],
            'barbie': ['muñecas', 'muñeca', 'barbie'],
            'hot wheels': ['carros', 'carro', 'hot wheels'],
            'nintendo': ['videojuegos', 'consola', 'nintendo'],
            'crayola': ['arte', 'creatividad', 'crayola'],
            'educativo': ['educativo', 'aprendizaje', 'fisher'],
            'acción': ['acción', 'figuras', 'marvel'],
            'exterior': ['exterior', 'deportes', 'bicicleta']
        };
        
        for (const [key, keywords] of Object.entries(categoryKeywords)) {
            if (categoryLower.includes(key) || keywords.some(k => categoryLower.includes(k))) {
                return product.category && product.category.toLowerCase().includes(keywords[0]);
            }
        }
        
        return false;
    });
}

// Función para obtener productos por rango de precio
async function getProductsByPriceRange(minPrice, maxPrice) {
    const products = await getProductsFromOdoo();
    
    if (!products || products.length === 0) {
        return [];
    }
    
    return products.filter(product => {
        const price = parseFloat(product.price);
        return price >= minPrice && price <= maxPrice;
    });
}

// Función para obtener productos por edad
async function getProductsByAge(age) {
    const products = await getProductsFromOdoo();
    
    if (!products || products.length === 0) {
        return [];
    }
    
    const ageNum = parseInt(age);
    
    return products.filter(product => {
        if (!product.age_range) return false;
        
        // Parsear rango de edad (ej: "3-6", "7+", "0-2")
        const range = product.age_range.toString();
        
        if (range.includes('-')) {
            const [min, max] = range.split('-').map(n => parseInt(n));
            return ageNum >= min && ageNum <= max;
        } else if (range.includes('+')) {
            const min = parseInt(range.replace('+', ''));
            return ageNum >= min;
        } else {
            const exactAge = parseInt(range);
            return ageNum === exactAge;
        }
    });
}

// Función para obtener información detallada de un producto específico
async function getProductDetails(productId) {
    try {
        const response = await queryOdoo('whatsapp/product_query', {
            product_id: productId,
            include_stock: true,
            include_images: true,
            include_alternatives: true,
            include_upsell: true
        });
        
        if (response && response.success) {
            return response.data;
        } else {
            console.error('Error obteniendo detalles del producto:', response);
            return null;
        }
    } catch (error) {
        console.error('Error en getProductDetails:', error.message);
        return null;
    }
}

// Función para obtener stock por sucursal
async function getStockByStore(productId) {
    try {
        const response = await queryOdoo('whatsapp/stock_by_store', {
            product_id: productId
        });
        
        if (response && response.success) {
            return response.data;
        } else {
            console.error('Error obteniendo stock por sucursal:', response);
            return null;
        }
    } catch (error) {
        console.error('Error en getStockByStore:', error.message);
        return null;
    }
}

// Función para obtener productos alternativos
async function getAlternativeProducts(productId, category) {
    try {
        const response = await queryOdoo('whatsapp/alternatives', {
            product_id: productId,
            category: category,
            limit: 3
        });
        
        if (response && response.success) {
            return response.data;
        } else {
            console.error('Error obteniendo alternativas:', response);
            return null;
        }
    } catch (error) {
        console.error('Error en getAlternativeProducts:', error.message);
        return null;
    }
}

// Función para obtener upsell recomendado
async function getUpsellRecommendation(productId) {
    try {
        const response = await queryOdoo('whatsapp/upsell', {
            product_id: productId,
            include_bundle_price: true
        });
        
        if (response && response.success) {
            return response.data;
        } else {
            console.error('Error obteniendo upsell:', response);
            return null;
        }
    } catch (error) {
        console.error('Error en getUpsellRecommendation:', error.message);
        return null;
    }
}

// Función para reservar producto en Odoo
async function reserveProduct(productId, userId, quantity = 1) {
    try {
        const response = await queryOdoo('whatsapp/reserve_product', {
            product_id: productId,
            user_id: userId,
            quantity: quantity,
            reservation_type: 'whatsapp'
        });
        
        if (response && response.success) {
            return response.data;
        } else {
            console.error('Error reservando producto:', response);
            return null;
        }
    } catch (error) {
        console.error('Error en reserveProduct:', error.message);
        return null;
    }
}

// Función para transferir a vendedor
async function transferToSalesperson(userId, productId, reason) {
    try {
        const response = await queryOdoo('whatsapp/transfer_to_sales', {
            user_id: userId,
            product_id: productId,
            reason: reason,
            timestamp: new Date().toISOString()
        });
        
        if (response && response.success) {
            return response.data;
        } else {
            console.error('Error transfiriendo a vendedor:', response);
            return null;
        }
    } catch (error) {
        console.error('Error en transferToSalesperson:', error.message);
        return null;
    }
}

// Función para búsqueda filtrada avanzada en Odoo
async function searchProductsWithFilters(filters) {
    try {
        const response = await queryOdoo('whatsapp/search_filtered', {
            age_range: filters.ageRange,
            gender: filters.gender,
            category: filters.category,
            brand: filters.brand,
            max_price: filters.maxPrice,
            min_price: filters.minPrice,
            has_discounts: filters.hasDiscounts,
            limit: 5,
            include_images: true,
            include_stock: true
        });
        
        if (response && response.success) {
            return response.data;
        } else {
            console.error('Error en búsqueda filtrada:', response);
            return null;
        }
    } catch (error) {
        console.error('Error en searchProductsWithFilters:', error.message);
        return null;
    }
}

// Función para obtener sugerencias de búsqueda basadas en trends
async function getSearchSuggestions(filters) {
    try {
        const response = await queryOdoo('whatsapp/search_suggestions', {
            failed_filters: filters,
            include_trends: true,
            include_popular: true
        });
        
        if (response && response.success) {
            return response.data;
        } else {
            console.error('Error obteniendo sugerencias:', response);
            return null;
        }
    } catch (error) {
        console.error('Error en getSearchSuggestions:', error.message);
        return null;
    }
}

// Función para obtener promociones activas por categoría
async function getActivePromotionsByCategory(category) {
    try {
        const response = await queryOdoo('whatsapp/promotions_by_category', {
            category: category,
            active_only: true,
            include_codes: true
        });
        
        if (response && response.success) {
            return response.data;
        } else {
            console.error('Error obteniendo promociones por categoría:', response);
            return null;
        }
    } catch (error) {
        console.error('Error en getActivePromotionsByCategory:', error.message);
        return null;
    }
}

// Función para registrar lead de búsqueda en CRM
async function logSearchLead(userId, filters, results) {
    try {
        const response = await queryOdoo('whatsapp/log_search_lead', {
            user_id: userId,
            search_filters: filters,
            results_count: results ? results.length : 0,
            timestamp: new Date().toISOString(),
            lead_type: 'product_search'
        });
        
        if (response && response.success) {
            console.log(`Lead de búsqueda registrado para usuario ${userId}`);
        }
    } catch (error) {
        console.error('Error registrando lead de búsqueda:', error.message);
    }
}

// Función para generar link dinámico a la web
function generateWebLink(filters) {
    let baseUrl = 'https://toysnicaragua.com/categoria/';
    
    if (filters.category) {
        baseUrl += filters.category.toLowerCase().replace(/\s+/g, '-');
    } else {
        baseUrl += 'todos';
    }
    
    const params = new URLSearchParams();
    
    if (filters.ageRange) params.append('edad', filters.ageRange);
    if (filters.gender) params.append('genero', filters.gender);
    if (filters.brand) params.append('marca', filters.brand);
    if (filters.maxPrice) params.append('precio_max', filters.maxPrice);
    if (filters.hasDiscounts) params.append('descuentos', 'si');
    
    if (params.toString()) {
        baseUrl += '?' + params.toString();
    }
    
    return baseUrl;
}

// Función para parsear filtros del texto del usuario
function parseFiltersFromText(text) {
    const filters = {};
    const lowerText = text.toLowerCase();
    
    // Parsear edad
    const agePatterns = [
        /(\d+)-(\d+)\s*años?/,
        /(\d+)\s*años?/,
        /bebés?/,
        /preescolar/,
        /escolar/,
        /adolescentes?/
    ];
    
    for (const pattern of agePatterns) {
        const match = lowerText.match(pattern);
        if (match) {
            if (match[1] && match[2]) {
                filters.ageRange = `${match[1]}-${match[2]} años`;
            } else if (match[1]) {
                filters.ageRange = `${match[1]} años`;
            } else if (lowerText.includes('bebés') || lowerText.includes('bebes')) {
                filters.ageRange = '0-2 años';
            } else if (lowerText.includes('preescolar')) {
                filters.ageRange = '3-6 años';
            } else if (lowerText.includes('escolar')) {
                filters.ageRange = '7-12 años';
            } else if (lowerText.includes('adolescentes')) {
                filters.ageRange = '13+ años';
            }
            break;
        }
    }
    
    // Parsear género
    if (lowerText.includes('niña') || lowerText.includes('nina')) {
        filters.gender = 'niña';
    } else if (lowerText.includes('niño') || lowerText.includes('nino')) {
        filters.gender = 'niño';
    } else if (lowerText.includes('unisex')) {
        filters.gender = 'unisex';
    }
    
    // Parsear categoría
    const categories = {
        'educativos': 'educativos',
        'sostenibles': 'sostenibles',
        'tendencias': 'tendencias',
        'construcción': 'construcción',
        'construccion': 'construcción',
        'muñecas': 'muñecas',
        'munecas': 'muñecas',
        'carros': 'carros',
        'videojuegos': 'videojuegos',
        'arte': 'arte',
        'acción': 'acción',
        'accion': 'acción',
        'exterior': 'exterior'
    };
    
    for (const [key, value] of Object.entries(categories)) {
        if (lowerText.includes(key)) {
            filters.category = value;
            break;
        }
    }
    
    // Parsear marca
    const brands = {
        'lego': 'LEGO',
        'barbie': 'Barbie',
        'hot wheels': 'Hot Wheels',
        'nintendo': 'Nintendo',
        'crayola': 'Crayola',
        'fisher-price': 'Fisher-Price',
        'fisher price': 'Fisher-Price',
        'marvel': 'Marvel'
    };
    
    for (const [key, value] of Object.entries(brands)) {
        if (lowerText.includes(key)) {
            filters.brand = value;
            break;
        }
    }
    
    // Parsear precio
    const pricePatterns = [
        /menos\s+de\s+c?\$?(\d+)/i,
        /máximo\s+c?\$?(\d+)/i,
        /maximo\s+c?\$?(\d+)/i,
        /hasta\s+c?\$?(\d+)/i,
        /c?\$?(\d+)\s+o\s+menos/i
    ];
    
    for (const pattern of pricePatterns) {
        const match = lowerText.match(pattern);
        if (match) {
            filters.maxPrice = parseInt(match[1]);
            break;
        }
    }
    
    // Parsear descuentos
    if (lowerText.includes('sí') || lowerText.includes('si') || lowerText.includes('yes') || lowerText.includes('descuentos')) {
        filters.hasDiscounts = true;
    }
    
    return filters;
}

// Generar QR
client.on('qr', (qr) => {
    console.log('🧸 ESCANEA ESTE CÓDIGO QR EN WHATSAPP:');
    qrcode.generate(qr, { small: true });
});

// Bot conectado
client.on('ready', async () => {
    console.log('🎉 ¡ToysBot está listo! Escanea el QR para conectar.');
    
    // Cargar productos y promociones iniciales
    try {
        await getProductsFromOdoo();
        await getPromotionsFromOdoo();
        console.log('✅ Datos iniciales cargados desde Odoo');
    } catch (error) {
        console.error('❌ Error cargando datos iniciales:', error.message);
    }
});

// Manejar mensajes
client.on('message', async (message) => {
    const content = message.body;
    const userId = message.from;
    
    // 🆕 SEXTA ETAPA: Manejo de inactividad y escalado automático
    const needsInactivityReminder = handleInactivityTimeout(userId, message);
    if (needsInactivityReminder) {
        await message.reply('👋 ¡Hola! ¿Sigues ahí? Si necesitas más ayuda, responde.');
    }
    
    // Detectar consultas complejas que requieren escalado inmediato
    const userContext = userContexts.get(userId);
    const complexQuery = detectComplexQuery(content, userContext);
    
    if (complexQuery.needsEscalation) {
        // Escalar inmediatamente a agente humano
        await message.reply(`🤔 Entiendo que esto requiere atención detallada. Te transfiero a un experto ahora. ¿Sucursal preferida?`);
        
        // Crear ticket de escalado en Odoo
        const conversationSummary = await getConversationSummary(userId);
        const escalationTicket = await escalateComplexQuery(
            userId, 
            complexQuery.reason, 
            conversationSummary
        );
        
        if (escalationTicket) {
            console.log(`Ticket de escalado creado: ${escalationTicket.id}`);
        }
        
        // Proceder como etapa 5 (handover)
        userContexts.set(userId, { 
            section: 'store_handover', 
            step: 'store_handover',
            handoverReason: complexQuery.reason,
            escalationTicket: escalationTicket
        });
        
        return;
    }
    
    // Detectar origen del mensaje
    const origin = detectMessageOrigin(message);
    
    // Registrar interacción en Odoo
    await logInteraction(userId, content, origin.origin);
    
    // Si es mensaje vacío o no válido
    if (!content || content.trim() === '') {
        await message.reply('¡Hola! No entendí tu mensaje. Por favor, dime cómo te ayudo con juguetes en Toys.');
        return;
    }
    
    // Saludo inicial
    if (content.toLowerCase() === 'hola' || content.toLowerCase() === 'hello') {
        const user = userData.get(userId) || {};
        
        if (origin.origin === 'ad') {
            // Saludo para usuarios que vienen de ads
            const productName = origin.productName || 'nuestro producto';
            const platform = origin.platform === 'facebook' ? 'Facebook' : 
                           origin.platform === 'instagram' ? 'Instagram' : 'Facebook/Instagram';
            
            await message.reply(`¡Hola! Bienvenido a Toys, la cadena líder en juguetes educativos, sostenibles y de tendencias en Nicaragua. Vi que vienes de nuestro anuncio en ${platform} sobre ${productName}. ¿Quieres saber el precio, stock, descripción o algo más? Responde con: 1. Precio, 2. Stock, 3. Descripción, 4. Otras opciones.`);
            
            // Establecer contexto de ad
            userContext.set(userId, { 
                section: 'ad_response', 
                step: 'waiting_choice',
                productId: origin.productId,
                productName: origin.productName
            });
        } else {
            // Saludo general
            await message.reply(`¡Hola! Bienvenido a Toys. ¿En qué te ayudo hoy con juguetes para niños? Elige una opción: 1. Consultar precio de un producto específico, 2. Buscar productos por categoría/edad/género/marca/precio, 3. Ver descuentos o promociones (¡como 15% off en educativos para Día del Niño!), 4. Información sobre sucursales, 5. Comprar online (te envío link a nuestra web). Si prefieres atención personal, responde 'Hablar con vendedor'.`);
            
            // Establecer contexto general
            userContext.set(userId, { section: 'general', step: 'waiting_choice' });
        }
        
        // Preguntar idioma (español predeterminado)
            setTimeout(async () => {
            await message.reply('🌍 ¿En qué idioma prefieres que te ayude? (Español predeterminado) / What language would you prefer? (Spanish default)');
            }, 1000);
        
        // Guardar datos del usuario
        if (!user.name) {
            user.askingForName = true;
            user.language = 'es';
            userData.set(userId, user);
        }
    }
        // Capturar nombre del usuario
    else if (userData.get(userId)?.askingForName) {
        const user = userData.get(userId);
        user.name = content;
        user.askingForName = false;
        userData.set(userId, user);
        
        await message.reply(`¡Mucho gusto ${content}! 😊 Me alegra conocerte.\n\n¿Cómo puedo ayudarte hoy? 🤗`);
        
        // Mostrar menú según el contexto
        setTimeout(async () => {
            const context = userContext.get(userId);
            if (context?.section === 'ad_response') {
                await message.reply(`Responde con: 1. Precio, 2. Stock, 3. Descripción, 4. Otras opciones.`);
            } else {
                await message.reply(`Elige una opción: 1. Consultar precio, 2. Buscar productos, 3. Ver descuentos, 4. Información sucursales, 5. Comprar online, 6. Búsqueda avanzada, 7. Hablar con vendedor.`);
            }
        }, 1000);
    }
    // Manejar respuestas de ads
    else if (userContext.get(userId)?.section === 'ad_response' && userContext.get(userId)?.step === 'waiting_choice') {
        const context = userContext.get(userId);
        const productId = context.productId;
        
        // Obtener información detallada del producto desde Odoo
        const productDetails = await getProductDetails(productId);
        
        if (!productDetails) {
            await message.reply('Lo siento, no pude obtener la información del producto. Te ayudo con nuestro catálogo general. Escribe "menú" para ver las opciones.');
            userContext.set(userId, { section: 'general', step: 'waiting_choice' });
            return;
        }
        
        switch (content) {
            case '1':
            case '1.':
            case 'precio':
                // Respuesta principal con precio, stock y descripción
                let priceResponse = `💰 *${productDetails.name}*\n\n`;
                priceResponse += `Precio: C$${productDetails.price}\n`;
                priceResponse += `Stock disponible: ${productDetails.stock} unidades\n`;
                priceResponse += `Descripción: ${productDetails.description}\n\n`;
                
                // Agregar upsell si está disponible
                if (productDetails.upsell) {
                    priceResponse += `🔥 *¡Oferta especial!*\n`;
                    priceResponse += `Combínalo con ${productDetails.upsell.name} y ahorra 10%\n`;
                    priceResponse += `Total bundle: C$${productDetails.upsell.bundle_price}\n\n`;
                }
                
                priceResponse += `¿Quieres ver foto? Responde 'Sí'.\n`;
                priceResponse += `¿Interesado en comprarlo? Te envío link: www.toysnicaragua.com/producto/${productId}\n\n`;
                priceResponse += `O elige:\n`;
                priceResponse += `1. Stock por sucursal\n`;
                priceResponse += `2. Alternativas si agotado\n`;
                priceResponse += `3. Agregar a carrito (reserva)\n`;
                priceResponse += `4. Transferir a vendedor`;
                
                userContext.set(userId, { 
                    section: 'ad_response', 
                    step: 'price_details',
                    productDetails: productDetails,
                    interactionCount: 1
                });
                
                await message.reply(priceResponse);
                break;
                
            case '2':
            case '2.':
            case 'stock':
                // Mostrar stock por sucursal
                const stockByStore = await getStockByStore(productId);
                let stockResponse = `📦 *${productDetails.name} - Stock por Sucursal*\n\n`;
                
                if (stockByStore && stockByStore.length > 0) {
                    stockByStore.forEach(store => {
                        stockResponse += `🏪 *${store.name}*\n`;
                        stockResponse += `   Stock: ${store.stock} unidades\n`;
                        stockResponse += `   Dirección: ${store.address}\n\n`;
                    });
        } else {
                    stockResponse += `Stock total: ${productDetails.stock} unidades\n`;
                    stockResponse += `Disponible en todas las sucursales\n\n`;
                }
                
                stockResponse += `¿Quieres ver alternativas o agregar al carrito?`;
                
                userContext.set(userId, { 
                    section: 'ad_response', 
                    step: 'stock_details',
                    productDetails: productDetails,
                    interactionCount: 1
                });
                
                await message.reply(stockResponse);
                break;
                
            case '3':
            case '3.':
            case 'descripción':
                const description = productDetails.description || 'Juguete de alta calidad perfecto para el desarrollo y diversión de los niños.';
                
                let descResponse = `📝 *${productDetails.name}*\n\n`;
                descResponse += `${description}\n\n`;
                
                // Agregar características si están disponibles
                if (productDetails.features && productDetails.features.length > 0) {
                    descResponse += `✨ *Características:*\n`;
                    productDetails.features.forEach(feature => {
                        descResponse += `• ${feature}\n`;
                    });
                    descResponse += `\n`;
                }
                
                // Agregar información de edad si está disponible
                if (productDetails.age_range) {
                    descResponse += `👶 *Edad recomendada:* ${productDetails.age_range} años\n`;
                }
                
                // Agregar marca si está disponible
                if (productDetails.brand) {
                    descResponse += `🏷️ *Marca:* ${productDetails.brand}\n`;
                }
                
                descResponse += `\n¿Te gustaría saber el precio, stock o ver otros productos?`;
                
                userContext.set(userId, { 
                    section: 'ad_response', 
                    step: 'description_details',
                    productDetails: productDetails,
                    interactionCount: 1
                });
                
                await message.reply(descResponse);
                break;
                
            case '4':
            case '4.':
            case 'otras opciones':
            case 'otras':
                await message.reply(`🎯 *Otras opciones disponibles:*\n\n1. Ver productos similares\n2. Ver promociones vigentes\n3. Información de sucursales\n4. Comprar online\n5. Hablar con vendedor\n\n¿Qué te interesa?`);
                userContext.set(userId, { section: 'ad_response', step: 'other_options' });
                break;
                
            default:
                // Si no es una opción válida, incrementar contador de interacciones
                const currentContext = userContext.get(userId);
                const interactionCount = (currentContext.interactionCount || 0) + 1;
                
                if (interactionCount >= 3) {
                    // Ofrecer transferencia después de 3 interacciones no resueltas
                    await message.reply(`Parece que necesitas más ayuda. ¿Quieres que te transfiera a un vendedor de la sucursal más cercana? Responde 'Sí' para transferir o 'No' para continuar.`);
                    userContext.set(userId, { 
                        section: 'ad_response', 
                        step: 'offer_transfer',
                        productDetails: productDetails,
                        interactionCount: interactionCount
                    });
                } else {
                    await message.reply(`Por favor responde con: 1. Precio, 2. Stock, 3. Descripción, 4. Otras opciones.`);
                    userContext.set(userId, { 
                        ...currentContext, 
                        interactionCount: interactionCount 
                    });
                }
        }
    }
    
    // Manejar otras opciones de ads
    else if (userContext.get(userId)?.section === 'ad_response' && userContext.get(userId)?.step === 'other_options') {
        switch (content) {
            case '1':
            case '1.':
            case 'productos similares':
                const context = userContext.get(userId);
                const productId = context.productId;
                const products = await getProductsFromOdoo();
                const product = products.find(p => p.id == productId);
                
            if (product) {
                    const similarProducts = products.filter(p => 
                        p.category === product.category && p.id !== product.id
                    ).slice(0, 3);
                    
                    let response = `🎯 *Productos similares a ${product.name}:*\n\n`;
                    similarProducts.forEach((p, i) => {
                        response += `${i + 1}. ${p.name} - $${p.price} USD\n`;
                    });
                    response += '\n¿Te interesa alguno o quieres ver más opciones?';
                    
                    await message.reply(response);
                }
                break;
            case '2':
            case '2.':
            case 'promociones':
                const promotions = await getPromotionsFromOdoo();
                let promos = '🔥 *Promociones Vigentes:*\n\n';
                
                if (promotions.length > 0) {
                    promotions.slice(0, 5).forEach(promo => {
                        promos += `${promo.title}\n`;
                        if (promo.description) promos += `${promo.description}\n`;
                        promos += '\n';
                    });
                } else {
                    promos += 'No hay promociones activas en este momento.\n';
                }
                
                promos += '¿Te interesa alguna promoción?';
                await message.reply(promos);
                break;
            case '3':
            case '3.':
            case 'sucursales':
                await message.reply(`🏪 *Nuestras Sucursales:*\n\n• Camino de Oriente - Módulo B-3\n• Multicentro Las Américas\n• Bolonia - Cerca PriceSmart\n• Metrocentro - Primer nivel\n• Uniplaza Sur - Km 8\n• Multicentro Las Brisas\n• Plaza Once - Carretera Masaya\n• Galerías Santo Domingo\n\nHorarios: 9:00 AM - 8:00 PM\n\n¿Cuál te queda más cerca?`);
                break;
            case '4':
            case '4.':
            case 'comprar online':
                await message.reply(`🛒 *Compra Online:*\n\n🌐 Sitio web: https://toysnicaragua.com\n\nO si prefieres, puedo ayudarte a coordinar la compra por WhatsApp. ¿Qué prefieres?`);
                break;
            case '5':
            case '5.':
            case 'hablar con vendedor':
            case 'vendedor':
                await message.reply(`👨‍💼 *Conectando con vendedor...*\n\nUn asesor de TOYS se pondrá en contacto contigo en los próximos minutos.\n\nMientras tanto, puedes:\n• Ver más productos\n• Consultar promociones\n• Escribir "menú" para volver`);
                break;
            default:
                await message.reply(`Por favor elige una opción del 1 al 5, o escribe "menú" para volver al inicio.`);
        }
    }
    
    // Manejar consultas específicas de precio
    else if (userContext.get(userId)?.section === 'ad_response' && userContext.get(userId)?.step === 'price_details') {
        const context = userContext.get(userId);
        const productDetails = context.productDetails;
        
        if (content.toLowerCase().includes('sí') || content.toLowerCase().includes('si') || content.toLowerCase().includes('yes')) {
            // Usuario quiere ver foto
            if (productDetails.image_url) {
                await message.reply(`📸 *Foto del ${productDetails.name}*\n\n${productDetails.image_url}\n\n¿Te gusta? ¿Quieres agregarlo al carrito?`);
            } else {
                await message.reply(`Lo sentimos, no tenemos foto disponible del ${productDetails.name}. ¿Te gustaría que te reserve una unidad o prefieres ver otros productos?`);
            }
        } else if (content === '1' || content === '1.') {
            // Stock por sucursal
            const stockByStore = await getStockByStore(productDetails.id);
            let stockResponse = `📦 *${productDetails.name} - Stock por Sucursal*\n\n`;
            
            if (stockByStore && stockByStore.length > 0) {
                stockByStore.forEach(store => {
                    stockResponse += `🏪 *${store.name}*\n`;
                    stockResponse += `   Stock: ${store.stock} unidades\n`;
                    stockResponse += `   Dirección: ${store.address}\n\n`;
                });
            } else {
                stockResponse += `Stock total: ${productDetails.stock} unidades\n`;
                stockResponse += `Disponible en todas las sucursales\n\n`;
            }
            
            stockResponse += `¿Quieres ver alternativas o agregar al carrito?`;
            await message.reply(stockResponse);
            
        } else if (content === '2' || content === '2.') {
            // Alternativas si agotado
            if (productDetails.stock <= 0) {
                const alternatives = await getAlternativeProducts(productDetails.id, productDetails.category);
                let altResponse = `🔄 *${productDetails.name} está agotado temporalmente*\n\n`;
                altResponse += `Te recomiendo estas alternativas:\n\n`;
                
                if (alternatives && alternatives.length > 0) {
                    alternatives.forEach((alt, i) => {
                        altResponse += `${i + 1}. *${alt.name}* - C$${alt.price}\n`;
                        altResponse += `   ${alt.description}\n\n`;
                    });
                    altResponse += `¿Te interesa alguna? Responde 'Sí' para más info o 'No' para buscar otro.`;
                } else {
                    altResponse += `No hay alternativas disponibles en este momento.\n`;
                    altResponse += `¿Quieres que te transfiera a un vendedor?`;
                }
                
                await message.reply(altResponse);
            } else {
                await message.reply(`¡Excelente! El ${productDetails.name} está disponible. ¿Quieres que te lo reserve o prefieres comprarlo online?`);
            }
            
        } else if (content === '3' || content === '3.') {
            // Agregar a carrito (reserva)
            const reservation = await reserveProduct(productDetails.id, userId);
            
            if (reservation && reservation.success) {
                let reserveResponse = `🛒 *Producto reservado exitosamente!*\n\n`;
                reserveResponse += `✅ ${productDetails.name} reservado\n`;
                reserveResponse += `📅 Válido hasta: ${reservation.valid_until}\n`;
                reserveResponse += `🏪 Sucursal: ${reservation.store_name}\n`;
                reserveResponse += `📞 Teléfono: ${reservation.store_phone}\n\n`;
                reserveResponse += `Tu reserva está lista. Ve a la sucursal con este código: *${reservation.reservation_code}*`;
                
                await message.reply(reserveResponse);
            } else {
                await message.reply(`Lo sentimos, no se pudo realizar la reserva. ¿Quieres que te transfiera a un vendedor para ayudarte?`);
            }
            
        } else if (content === '4' || content === '4.') {
            // Transferir a vendedor
            const transfer = await transferToSalesperson(userId, productDetails.id, 'Consulta específica de producto');
            
            if (transfer && transfer.success) {
                let transferResponse = `👨‍💼 *Transferencia a vendedor exitosa*\n\n`;
                transferResponse += `Un vendedor de ${transfer.store_name} se pondrá en contacto contigo en los próximos minutos.\n\n`;
                transferResponse += `📞 Teléfono: ${transfer.salesperson_phone}\n`;
                transferResponse += `👤 Vendedor: ${transfer.salesperson_name}\n`;
                transferResponse += `⏰ Horario: ${transfer.store_hours}\n\n`;
                transferResponse += `Mientras tanto, puedes:\n`;
                transferResponse += `• Ver más productos\n`;
                transferResponse += `• Consultar promociones\n`;
                transferResponse += `• Escribir "menú" para volver`;
                
                await message.reply(transferResponse);
            } else {
                await message.reply(`Lo sentimos, no se pudo realizar la transferencia. ¿Puedes intentar más tarde o prefieres que te ayude con otra cosa?`);
            }
            
        } else {
            // Incrementar contador de interacciones
            const interactionCount = (context.interactionCount || 1) + 1;
            
            if (interactionCount >= 3) {
                await message.reply(`Parece que necesitas más ayuda. ¿Quieres que te transfiera a un vendedor de la sucursal más cercana? Responde 'Sí' para transferir o 'No' para continuar.`);
                userContext.set(userId, { 
                    ...context, 
                    step: 'offer_transfer',
                    interactionCount: interactionCount 
                });
            } else {
                await message.reply(`Por favor elige una opción del 1 al 4, o responde 'Sí' si quieres ver la foto del producto.`);
                userContext.set(userId, { 
                    ...context, 
                    interactionCount: interactionCount 
                });
            }
        }
    }
    
    // Manejar oferta de transferencia
    else if (userContext.get(userId)?.section === 'ad_response' && userContext.get(userId)?.step === 'offer_transfer') {
        const context = userContext.get(userId);
        const productDetails = context.productDetails;
        
        if (content.toLowerCase().includes('sí') || content.toLowerCase().includes('si') || content.toLowerCase().includes('yes')) {
            // Usuario acepta transferencia
            const transfer = await transferToSalesperson(userId, productDetails.id, 'Transferencia por múltiples interacciones');
            
            if (transfer && transfer.success) {
                let transferResponse = `👨‍💼 *Transferencia a vendedor exitosa*\n\n`;
                transferResponse += `Un vendedor de ${transfer.store_name} se pondrá en contacto contigo en los próximos minutos.\n\n`;
                transferResponse += `📞 Teléfono: ${transfer.salesperson_phone}\n`;
                transferResponse += `👤 Vendedor: ${transfer.salesperson_name}\n`;
                transferResponse += `⏰ Horario: ${transfer.store_hours}\n\n`;
                transferResponse += `Mientras tanto, puedes:\n`;
                transferResponse += `• Ver más productos\n`;
                transferResponse += `• Consultar promociones\n`;
                transferResponse += `• Escribir "menú" para volver`;
                
                await message.reply(transferResponse);
            } else {
                await message.reply(`Lo sentimos, no se pudo realizar la transferencia. ¿Puedes intentar más tarde o prefieres que te ayude con otra cosa?`);
            }
        } else {
            // Usuario no quiere transferencia
            await message.reply(`Entendido. ¿En qué más puedo ayudarte? Puedes:\n\n1. Ver otros productos\n2. Consultar promociones\n3. Información de sucursales\n4. Comprar online\n\nO escribe "menú" para volver al inicio.`);
            userContext.set(userId, { 
                ...context, 
                step: 'continue_help',
                interactionCount: 0 
            });
        }
    }
    
    // Manejar respuestas generales
    else if (userContext.get(userId)?.section === 'general' && userContext.get(userId)?.step === 'waiting_choice') {
        switch (content) {
            case '1':
            case '1.':
            case 'consultar precio':
                await message.reply(`💰 *Consulta de Precios:*\n\nEscribe el nombre del producto que te interesa o elige una categoría:\n\n1. Construcción (LEGO, etc.)\n2. Muñecas (Barbie, etc.)\n3. Carros (Hot Wheels, etc.)\n4. Videojuegos\n5. Arte (Crayola, etc.)\n6. Educativo\n7. Acción\n8. Exterior\n\n¿Qué te interesa?`);
                userContext.set(userId, { section: 'general', step: 'price_inquiry' });
                break;
            case '2':
            case '2.':
            case 'buscar productos':
                await message.reply(`🔍 *Búsqueda de Productos:*\n\n¿Cómo quieres buscar?\n\n1. Por categoría\n2. Por edad\n3. Por género\n4. Por marca\n5. Por precio\n\nElige una opción o escribe "menú" para volver.`);
                userContext.set(userId, { section: 'general', step: 'product_search' });
                break;
            case '3':
            case '3.':
            case 'descuentos':
            case 'promociones':
                const promotions = await getPromotionsFromOdoo();
                let promos = '🔥 *Promociones Vigentes:*\n\n';
                
                if (promotions.length > 0) {
                    promotions.forEach((promo, i) => {
                        promos += `${promo.title}\n`;
                        if (promo.description) promos += `${promo.description}\n`;
                        promos += '\n';
                    });
                } else {
                    promos += 'No hay promociones activas en este momento.\n';
                }
                
                promos += '⏰ ¡Estas ofertas son por tiempo limitado!\n\n¿Te interesa alguna promoción específica?';
                await message.reply(promos);
                break;
            case '4':
            case '4.':
            case 'sucursales':
            case 'información sucursales':
                await message.reply(`🏪 *Nuestras Sucursales:*\n\n• Camino de Oriente - Módulo B-3\n• Multicentro Las Américas\n• Bolonia - Cerca PriceSmart\n• Metrocentro - Primer nivel\n• Uniplaza Sur - Km 8\n• Multicentro Las Brisas\n• Plaza Once - Carretera Masaya\n• Galerías Santo Domingo\n\nHorarios: 9:00 AM - 8:00 PM\n\n¿Cuál te queda más cerca o quieres ver el menú?`);
                break;
            case '5':
            case '5.':
            case 'comprar online':
            case 'online':
                await message.reply(`🛒 *Compra Online:*\n\n🌐 Sitio web: https://toysnicaragua.com\n\nO si prefieres, puedo ayudarte a coordinar la compra por WhatsApp. ¿Qué prefieres?`);
                break;
            case 'hablar con vendedor':
            case 'vendedor':
            case 'asesor':
                await message.reply(`👨‍💼 *Conectando con vendedor...*\n\nUn asesor de TOYS se pondrá en contacto contigo en los próximos minutos.\n\nMientras tanto, puedes:\n• Ver más productos\n• Consultar promociones\n• Escribir "menú" para volver`);
                break;
            default:
                await message.reply(`Por favor elige una opción del 1 al 5, o escribe "menú" para volver al inicio.`);
        }
    }
    // Manejar consulta de precios
    else if (userContext.get(userId)?.section === 'general' && userContext.get(userId)?.step === 'price_inquiry') {
        if (content === 'menú' || content === 'menu') {
            userContext.set(userId, { section: 'general', step: 'waiting_choice' });
            await message.reply(`Elige una opción: 1. Consultar precio, 2. Buscar productos, 3. Ver descuentos, 4. Información sucursales, 5. Comprar online.`);
            return;
        }
        
        // Buscar producto por nombre o categoría
        const searchTerm = content.toLowerCase();
        let foundProducts = [];
        
        if (searchTerm.includes('lego') || searchTerm.includes('construcción')) {
            foundProducts = await getProductsByCategory('construcción');
        } else if (searchTerm.includes('barbie') || searchTerm.includes('muñeca')) {
            foundProducts = await getProductsByCategory('muñecas');
        } else if (searchTerm.includes('hot wheels') || searchTerm.includes('carro')) {
            foundProducts = await getProductsByCategory('carros');
        } else if (searchTerm.includes('nintendo') || searchTerm.includes('videojuego')) {
            foundProducts = await getProductsByCategory('videojuegos');
        } else if (searchTerm.includes('crayola') || searchTerm.includes('arte')) {
            foundProducts = await getProductsByCategory('arte');
        } else if (searchTerm.includes('educativo') || searchTerm.includes('fisher')) {
            foundProducts = await getProductsByCategory('educativo');
        } else if (searchTerm.includes('acción') || searchTerm.includes('marvel')) {
            foundProducts = await getProductsByCategory('acción');
        } else if (searchTerm.includes('exterior') || searchTerm.includes('bicicleta')) {
            foundProducts = await getProductsByCategory('exterior');
        } else {
            // Búsqueda por nombre
            foundProducts = await searchProducts(searchTerm);
        }
        
        if (foundProducts.length > 0) {
            let response = `💰 *Productos encontrados:*\n\n`;
            foundProducts.slice(0, 5).forEach((p, i) => {
                response += `${i + 1}. ${p.name}\n   Precio: $${p.price} USD\n   Stock: ${p.stock} unidades\n\n`;
            });
            
            if (foundProducts.length > 5) {
                response += `... y ${foundProducts.length - 5} productos más.\n\n`;
            }
            
            response += `¿Te interesa alguno? Escribe el número o "menú" para volver.`;
            
            userContext.set(userId, { 
                section: 'general', 
                step: 'product_selection',
                products: foundProducts
            });
            
            await message.reply(response);
        } else {
            await message.reply(`No encontré productos que coincidan con "${content}". ¿Puedes ser más específico o escribir "menú" para ver otras opciones?`);
        }
    }
    // Manejar selección de producto
    else if (userContext.get(userId)?.section === 'general' && userContext.get(userId)?.step === 'product_selection') {
        if (content === 'menú' || content === 'menu') {
            userContext.set(userId, { section: 'general', step: 'waiting_choice' });
            await message.reply(`Elige una opción: 1. Consultar precio, 2. Buscar productos, 3. Ver descuentos, 4. Información sucursales, 5. Comprar online.`);
            return;
        }
        
        const productIndex = parseInt(content) - 1;
        const context = userContext.get(userId);
        
        if (isNaN(productIndex) || productIndex < 0 || productIndex >= context.products.length) {
            await message.reply(`Por favor escribe un número del 1 al ${context.products.length} para seleccionar un producto, o "menú" para volver.`);
            return;
        }
        
        const product = context.products[productIndex];
        const description = product.description || 'Juguete de alta calidad perfecto para el desarrollo y diversión de los niños.';
        
        let response = `🎯 *${product.name}* 🎯\n\n📝 *Descripción:* ${description}\n\n💰 *Precio:* $${product.price} USD\n📦 *Stock:* ${product.stock} unidades\n\n`;
            
            // Información adicional según el producto
            if (product.category === 'Construcción') {
                response += '🏗️ *Edad recomendada:* 6+ años\n';
                response += '🧩 *Piezas incluidas:* 200+ piezas\n';
            } else if (product.category === 'Muñecas') {
                response += '👸 *Incluye:* Muñeca + accesorios\n';
                response += '🎨 *Colores disponibles:* Rosa, azul, morado\n';
            } else if (product.category === 'Carros') {
                response += '🚗 *Carros incluidos:* 5 unidades\n';
                response += '🏁 *Accesorios:* Pista + elevador\n';
            }
            
        // Agregar información de edad si está disponible
        if (product.age_range) {
            response += `👶 *Edad recomendada:* ${product.age_range} años\n`;
        }
        
        // Agregar marca si está disponible
        if (product.brand) {
            response += `🏷️ *Marca:* ${product.brand}\n`;
        }
        
        response += '\n💡 *¿Quieres ver otro producto, comprar este o escribir "menú" para volver?*';
        
        userContext.set(userId, { 
            section: 'general', 
            step: 'product_detail',
            lastProduct: product.id
        });
        
            await message.reply(response);
        }
    // Manejar búsqueda de productos
    else if (userContext.get(userId)?.section === 'general' && userContext.get(userId)?.step === 'product_search') {
        if (content === 'menú' || content === 'menu') {
            userContext.set(userId, { section: 'general', step: 'waiting_choice' });
            await message.reply(`Elige una opción: 1. Consultar precio, 2. Buscar productos, 3. Ver descuentos, 4. Información sucursales, 5. Comprar online.`);
            return;
        }
        
        switch (content) {
            case '1':
            case '1.':
            case 'categoría':
                await message.reply(`🏷️ *Búsqueda por Categoría:*\n\nElige una categoría:\n\n1. Construcción (LEGO, etc.)\n2. Muñecas (Barbie, etc.)\n3. Carros (Hot Wheels, etc.)\n4. Videojuegos\n5. Arte (Crayola, etc.)\n6. Educativo\n7. Acción\n8. Exterior\n\n¿Cuál te interesa?`);
                userContext.set(userId, { section: 'general', step: 'category_search' });
                break;
            case '2':
            case '2.':
            case 'edad':
                await message.reply(`👶 *Búsqueda por Edad:*\n\n¿Qué edad tiene el niño/a?\n\n1. 0-2 años (Bebés)\n2. 3-6 años (Preescolar)\n3. 7-12 años (Escolar)\n4. 13+ años (Adolescentes)\n\nElige una opción o escribe la edad específica.`);
                userContext.set(userId, { section: 'general', step: 'age_search' });
                break;
            case '3':
            case '3.':
            case 'género':
                await message.reply(`👧👦 *Búsqueda por Género:*\n\n¿Prefieres juguetes para:\n\n1. Niñas\n2. Niños\n3. Unisex\n4. No importa\n\nElige una opción.`);
                userContext.set(userId, { section: 'general', step: 'gender_search' });
                break;
            case '4':
            case '4.':
            case 'marca':
                await message.reply(`🏷️ *Búsqueda por Marca:*\n\n¿Qué marca te interesa?\n\n1. LEGO\n2. Barbie\n3. Hot Wheels\n4. Nintendo\n5. Crayola\n6. Fisher-Price\n7. Marvel\n8. Otra\n\nElige una opción o escribe el nombre de la marca.`);
                userContext.set(userId, { section: 'general', step: 'brand_search' });
                break;
            case '5':
            case '5.':
            case 'precio':
                await message.reply(`💰 *Búsqueda por Precio:*\n\n¿En qué rango de precio buscas?\n\n1. $0 - $25 USD\n2. $26 - $50 USD\n3. $51 - $100 USD\n4. $101 - $200 USD\n5. $200+ USD\n\nElige una opción o escribe tu presupuesto máximo.`);
                userContext.set(userId, { section: 'general', step: 'price_search' });
                break;
            case '6':
            case '6.':
            case 'búsqueda avanzada':
            case 'busqueda avanzada':
            case 'avanzada':
                // Iniciar búsqueda avanzada con filtros múltiples
                await message.reply(`🔍 *¡Búsqueda Avanzada!*\n\nPara ayudarte mejor, dime todo en un mensaje:\n\n📝 **Ejemplo de respuesta:**\n"3-5 años, niña, educativos, LEGO, menos de C$300, sí descuentos"\n\n**O responde por partes:**\n• Edad: (ej. 3-5 años)\n• Género: (niño/niña/unisex)\n• Categoría: (educativos/sostenibles/tendencias)\n• Marca: (ej. LEGO)\n• Precio: (ej. menos de C$300)\n• Descuentos: (Sí/No)\n\n¿Qué prefieres?`);
                userContext.set(userId, { 
                    section: 'general', 
                    step: 'advanced_search',
                    filters: {},
                    waitingFor: 'all_filters'
                });
                break;
            case '7':
            case '7.':
            case 'hablar con vendedor':
            case 'vendedor':
                // Iniciar proceso de handover a vendedor
                await message.reply(`👨‍💼 *¡Perfecto! Te conecto con un vendedor*\n\nPara darte la mejor atención, necesito saber tu ubicación.\n\n¿En qué zona de Managua estás? (ej. Metrocentro, Linda Vista)\n\nO elige una de nuestras sucursales para que te conecte con un vendedor especializado.`);
                
                userContext.set(userId, { 
                    section: 'store_handover', 
                    step: 'store_handover',
                    handoverReason: 'solicitud_explicita'
                });
                break;
            default:
                // Verificar si han pasado 2 intentos sin entender
                const context = userContexts.get(userId);
                const failedAttempts = context?.failedAttempts || 0;
                
                if (failedAttempts >= 2) {
                    // Ofrecer cierre y feedback después de 2 intentos fallidos
                    await message.reply(`🤔 No capté eso. Parece que necesitas ayuda especializada.\n\n¿Te gustaría que te conecte con un vendedor experto? Responde 'Sí' para transferir o 'Menú' para volver al inicio.`);
                    
                    userContexts.set(userId, { 
                        ...context, 
                        step: 'offer_escalation',
                        failedAttempts: failedAttempts + 1
                    });
                } else {
                    // Incrementar contador de intentos fallidos
                    userContexts.set(userId, { 
                        ...context, 
                        failedAttempts: failedAttempts + 1 
                    });
                    
                    await message.reply(`Por favor elige una opción del 1 al 7, o escribe "menú" para volver.\n\n**Nuevas opciones:** 6. Búsqueda Avanzada, 7. Hablar con vendedor`);
                }
        }
    }
    
    // Manejar búsqueda avanzada
    else if (userContext.get(userId)?.section === 'general' && userContext.get(userId)?.step === 'advanced_search') {
        const context = userContext.get(userId);
        
        if (content === 'menú' || content === 'menu') {
            userContext.set(userId, { section: 'general', step: 'waiting_choice' });
            await message.reply(`Elige una opción: 1. Consultar precio, 2. Buscar productos, 3. Ver descuentos, 4. Información sucursales, 5. Comprar online.`);
            return;
        }
        
        if (context.waitingFor === 'all_filters') {
            // Procesar respuesta completa con todos los filtros
            const filters = parseFiltersFromText(content);
            
            if (Object.keys(filters).length === 0) {
                await message.reply(`No pude entender los filtros. Por favor responde con el formato:\n"3-5 años, niña, educativos, LEGO, menos de C$300, sí descuentos"\n\nO escribe "menú" para volver.`);
                return;
            }
            
            // Mostrar filtros reconocidos
            let filterSummary = `🔍 *Filtros reconocidos:*\n\n`;
            if (filters.ageRange) filterSummary += `👶 Edad: ${filters.ageRange}\n`;
            if (filters.gender) filterSummary += `👧👦 Género: ${filters.gender}\n`;
            if (filters.category) filterSummary += `🏷️ Categoría: ${filters.category}\n`;
            if (filters.brand) filterSummary += `🏭 Marca: ${filters.brand}\n`;
            if (filters.maxPrice) filterSummary += `💰 Precio máximo: C$${filters.maxPrice}\n`;
            if (filters.hasDiscounts) filterSummary += `🔥 Descuentos: Sí\n`;
            
            filterSummary += `\n🔍 Buscando productos...`;
            await message.reply(filterSummary);
            
            // Realizar búsqueda filtrada
            const searchResults = await searchProductsWithFilters(filters);
            
            // Registrar lead de búsqueda
            await logSearchLead(userId, filters, searchResults);
            
            if (searchResults && searchResults.length > 0) {
                // Mostrar resultados
                let resultsResponse = `✅ *¡Encontré ${searchResults.length} productos!*\n\n`;
                
                searchResults.forEach((product, i) => {
                    resultsResponse += `${i + 1}. *${product.name}*\n`;
                    resultsResponse += `   💰 C$${product.price}\n`;
                    resultsResponse += `   📝 ${product.description || 'Juguete de alta calidad'}\n`;
                    resultsResponse += `   📦 Stock: ${product.stock} unidades\n`;
                    
                    if (product.image_url) {
                        resultsResponse += `   📸 Foto disponible\n`;
                    }
                    resultsResponse += `\n`;
                });
                
                // Agregar promociones si hay descuentos
                if (filters.hasDiscounts && filters.category) {
                    const promotions = await getActivePromotionsByCategory(filters.category);
                    if (promotions && promotions.length > 0) {
                        resultsResponse += `🔥 *¡Promociones activas en ${filters.category}!*\n`;
                        promotions.forEach(promo => {
                            resultsResponse += `• ${promo.title}: ${promo.discount}\n`;
                            if (promo.code) {
                                resultsResponse += `  Código: *${promo.code}*\n`;
                            }
                        });
                        resultsResponse += `\n`;
                    }
                }
                
                // Generar link dinámico
                const webLink = generateWebLink(filters);
                resultsResponse += `🌐 **Ver todos en la web:** ${webLink}\n\n`;
                
                resultsResponse += `**¿Cuál te interesa?**\n`;
                resultsResponse += `• Responde con el número del producto\n`;
                resultsResponse += `• "Ver más" para más opciones\n`;
                resultsResponse += `• "Buscar de nuevo" para cambiar filtros\n`;
                resultsResponse += `• "Ver descuentos" para promociones\n`;
                resultsResponse += `• "menú" para volver`;
                
                userContext.set(userId, { 
                    ...context, 
                    step: 'search_results',
                    filters: filters,
                    results: searchResults,
                    waitingFor: 'product_selection'
                });
                
                await message.reply(resultsResponse);
                
            } else {
                // No hay resultados, mostrar sugerencias
                const suggestions = await getSearchSuggestions(filters);
                let noResultsResponse = `❌ *No encontramos coincidencias exactas*\n\n`;
                
                if (suggestions && suggestions.length > 0) {
                    noResultsResponse += `💡 *Te sugiero probar:*\n`;
                    suggestions.forEach(suggestion => {
                        noResultsResponse += `• ${suggestion.reason}: ${suggestion.suggestion}\n`;
                    });
                    noResultsResponse += `\n`;
                }
                
                noResultsResponse += `**Opciones:**\n`;
                noResultsResponse += `• "Buscar de nuevo" para cambiar filtros\n`;
                noResultsResponse += `• "Ver tendencias" para productos populares\n`;
                noResultsResponse += `• "Hablar con vendedor" para ayuda personal\n`;
                noResultsResponse += `• "menú" para volver`;
                
                userContext.set(userId, { 
                    ...context, 
                    step: 'no_results',
                    filters: filters,
                    waitingFor: 'next_action'
                });
                
                await message.reply(noResultsResponse);
            }
        }
    }
    
    // Manejar selección de producto en resultados de búsqueda
    else if (userContext.get(userId)?.section === 'general' && userContext.get(userId)?.step === 'search_results') {
        const context = userContext.get(userId);
        
        if (content === 'menú' || content === 'menu') {
            userContext.set(userId, { section: 'general', step: 'waiting_choice' });
            await message.reply(`Elige una opción: 1. Consultar precio, 2. Buscar productos, 3. Ver descuentos, 4. Información sucursales, 5. Comprar online.`);
            return;
        }
        
        if (content === 'ver más' || content === 'ver mas') {
            // Mostrar más productos (si hay más disponibles)
            await message.reply(`🌐 Para ver más productos, visita: ${generateWebLink(context.filters)}\n\nO escribe "buscar de nuevo" para cambiar los filtros.`);
            return;
        }
        
        if (content === 'buscar de nuevo' || content === 'buscar de nuevo') {
            userContext.set(userId, { 
                section: 'general', 
                step: 'advanced_search',
                filters: {},
                waitingFor: 'all_filters'
            });
            await message.reply(`🔍 *¡Búsqueda Avanzada!*\n\nPara ayudarte mejor, dime todo en un mensaje:\n\n📝 **Ejemplo de respuesta:**\n"3-5 años, niña, educativos, LEGO, menos de C$300, sí descuentos"\n\n¿Qué buscas?`);
            return;
        }
        
        if (content === 'ver descuentos' || content === 'ver descuentos') {
            const promotions = await getActivePromotionsByCategory(context.filters.category || 'todos');
            if (promotions && promotions.length > 0) {
                let promosResponse = `🔥 *¡Promociones Activas!*\n\n`;
                promotions.forEach(promo => {
                    promosResponse += `🎯 *${promo.title}*\n`;
                    promosResponse += `   ${promo.description}\n`;
                    promosResponse += `   💰 ${promo.discount}\n`;
                    if (promo.code) {
                        promosResponse += `   🎫 Código: *${promo.code}*\n`;
                    }
                    promosResponse += `   ⏰ Válido hasta: ${promo.valid_until}\n\n`;
                });
                
                promosResponse += `**¿Quieres aplicar algún descuento o ver más productos?**`;
                await message.reply(promosResponse);
            } else {
                await message.reply(`No hay promociones activas en este momento. ¿Quieres ver más productos o cambiar los filtros de búsqueda?`);
            }
            return;
        }
        
        // Selección de producto específico
        const productIndex = parseInt(content) - 1;
        if (isNaN(productIndex) || productIndex < 0 || productIndex >= context.results.length) {
            await message.reply(`Por favor escribe un número del 1 al ${context.results.length} para seleccionar un producto, o elige una de las opciones disponibles.`);
            return;
        }
        
        const selectedProduct = context.results[productIndex];
        
        // Mostrar detalles del producto seleccionado
        let productDetail = `🎯 *${selectedProduct.name}* 🎯\n\n`;
        productDetail += `📝 *Descripción:* ${selectedProduct.description || 'Juguete de alta calidad'}\n`;
        productDetail += `💰 *Precio:* C$${selectedProduct.price}\n`;
        productDetail += `📦 *Stock:* ${selectedProduct.stock} unidades\n`;
        
        if (selectedProduct.age_range) {
            productDetail += `👶 *Edad recomendada:* ${selectedProduct.ageRange} años\n`;
        }
        
        if (selectedProduct.brand) {
            productDetail += `🏷️ *Marca:* ${selectedProduct.brand}\n`;
        }
        
        if (selectedProduct.category) {
            productDetail += `🏷️ *Categoría:* ${selectedProduct.category}\n`;
        }
        
        productDetail += `\n**¿Qué quieres hacer?**\n`;
        productDetail += `• "Comprar" para ir a la web\n`;
        productDetail += `• "Reservar" para guardar en sucursal\n`;
        productDetail += `• "Ver más productos" para continuar buscando\n`;
        productDetail += `• "Buscar de nuevo" para cambiar filtros\n`;
        productDetail += `• "menú" para volver`;
        
        userContext.set(userId, { 
            ...context, 
            step: 'product_detail',
            selectedProduct: selectedProduct,
            waitingFor: 'product_action'
        });
        
        await message.reply(productDetail);
    }
    
    // Manejar acciones del producto seleccionado
    else if (userContext.get(userId)?.section === 'general' && userContext.get(userId)?.step === 'product_detail') {
        const context = userContext.get(userId);
        const selectedProduct = context.selectedProduct;
        
        if (content === 'menú' || content === 'menu') {
            userContext.set(userId, { section: 'general', step: 'waiting_choice' });
            await message.reply(`Elige una opción: 1. Consultar precio, 2. Buscar productos, 3. Ver descuentos, 4. Información sucursales, 5. Comprar online.`);
            return;
        }
        
        if (content.toLowerCase().includes('comprar')) {
            const webLink = `https://toysnicaragua.com/producto/${selectedProduct.id}`;
            await message.reply(`🛒 *¡Perfecto! Para comprar ${selectedProduct.name}:*\n\n🌐 **Sitio web:** ${webLink}\n\nO si prefieres, puedo ayudarte a coordinar la compra por WhatsApp. ¿Qué prefieres?`);
            return;
        }
        
        if (content.toLowerCase().includes('reservar')) {
            const reservation = await reserveProduct(selectedProduct.id, userId);
            
            if (reservation && reservation.success) {
                let reserveResponse = `🛒 *Producto reservado exitosamente!*\n\n`;
                reserveResponse += `✅ ${selectedProduct.name} reservado\n`;
                reserveResponse += `📅 Válido hasta: ${reservation.valid_until}\n`;
                reserveResponse += `🏪 Sucursal: ${reservation.store_name}\n`;
                reserveResponse += `📞 Teléfono: ${reservation.store_phone}\n\n`;
                reserveResponse += `Tu reserva está lista. Ve a la sucursal con este código: *${reservation.reservation_code}*`;
                
                await message.reply(reserveResponse);
            } else {
                await message.reply(`Lo sentimos, no se pudo realizar la reserva. ¿Quieres que te transfiera a un vendedor para ayudarte?`);
            }
            return;
        }
        
        if (content.toLowerCase().includes('ver más productos') || content.toLowerCase().includes('ver mas productos')) {
            // Volver a los resultados de búsqueda
            userContext.set(userId, { 
                ...context, 
                step: 'search_results',
                waitingFor: 'product_selection'
            });
            
            let resultsResponse = `🔍 *Resultados de búsqueda:*\n\n`;
            context.results.forEach((product, i) => {
                resultsResponse += `${i + 1}. *${product.name}* - C$${product.price}\n`;
                resultsResponse += `   ${product.description || 'Juguete de alta calidad'}\n\n`;
            });
            
            resultsResponse += `**¿Cuál te interesa?**\n`;
            resultsResponse += `• Responde con el número del producto\n`;
            resultsResponse += `• "Ver más" para más opciones\n`;
            resultsResponse += `• "Buscar de nuevo" para cambiar filtros\n`;
            resultsResponse += `• "menú" para volver`;
            
            await message.reply(resultsResponse);
            return;
        }
        
        if (content.toLowerCase().includes('buscar de nuevo')) {
            userContext.set(userId, { 
                section: 'general', 
                step: 'advanced_search',
                filters: {},
                waitingFor: 'all_filters'
            });
            await message.reply(`🔍 *¡Búsqueda Avanzada!*\n\nPara ayudarte mejor, dime todo en un mensaje:\n\n📝 **Ejemplo de respuesta:**\n"3-5 años, niña, educativos, LEGO, menos de C$300, sí descuentos"\n\n¿Qué buscas?`);
            return;
        }
        
        // Respuesta por defecto
        await message.reply(`Por favor elige una opción:\n• "Comprar" para ir a la web\n• "Reservar" para guardar en sucursal\n• "Ver más productos" para continuar buscando\n• "Buscar de nuevo" para cambiar filtros\n• "menú" para volver`);
    }
    
    // Manejar información detallada del producto (Cuarta Etapa)
    else if (userContext.get(userId)?.section === 'general' && userContext.get(userId)?.step === 'product_detail') {
        const context = userContext.get(userId);
        const selectedProduct = context.selectedProduct;
        
        if (content === 'menú' || content === 'menu') {
            userContext.set(userId, { section: 'general', step: 'waiting_choice' });
            await message.reply(`Elige una opción: 1. Consultar precio, 2. Buscar productos, 3. Ver descuentos, 4. Información sucursales, 5. Comprar online.`);
            return;
        }
        
        if (content.toLowerCase().includes('comprar')) {
            // Iniciar proceso de compra
            userContext.set(userId, { 
                ...context, 
                step: 'purchase_process',
                waitingFor: 'purchase_confirmation'
            });
            
            await message.reply(`🛒 *¡Excelente elección!*\n\nVoy a generar tu cotización para ${selectedProduct.name}.\n\n¿Quieres que proceda con la compra? Responde 'Sí' para continuar o 'No' para cancelar.`);
            return;
        }
        
        if (content.toLowerCase().includes('reservar')) {
            // Iniciar proceso de reserva
            userContext.set(userId, { 
                ...context, 
                step: 'reservation_process',
                waitingFor: 'reservation_confirmation'
            });
            
            await message.reply(`📅 *¡Perfecto! Vamos a reservar ${selectedProduct.name}*\n\n¿Quieres que proceda con la reserva? Responde 'Sí' para continuar o 'No' para cancelar.`);
            return;
        }
        
        if (content.toLowerCase().includes('ver más productos') || content.toLowerCase().includes('ver mas productos')) {
            // Volver a los resultados de búsqueda
            userContext.set(userId, { 
                ...context, 
                step: 'search_results',
                waitingFor: 'product_selection'
            });
            
            let resultsResponse = `🔍 *Resultados de búsqueda:*\n\n`;
            context.results.forEach((product, i) => {
                resultsResponse += `${i + 1}. *${product.name}* - C$${product.price}\n`;
                resultsResponse += `   ${product.description || 'Juguete de alta calidad'}\n\n`;
            });
            
            resultsResponse += `**¿Cuál te interesa?**\n`;
            resultsResponse += `• Responde con el número del producto\n`;
            resultsResponse += `• "Ver más" para más opciones\n`;
            resultsResponse += `• "Buscar de nuevo" para cambiar filtros\n`;
            resultsResponse += `• "menú" para volver`;
            
            await message.reply(resultsResponse);
            return;
        }
        
        if (content.toLowerCase().includes('buscar de nuevo')) {
            userContext.set(userId, { 
                section: 'general', 
                step: 'advanced_search',
                filters: {},
                waitingFor: 'all_filters'
            });
            await message.reply(`🔍 *¡Búsqueda Avanzada!*\n\nPara ayudarte mejor, dime todo en un mensaje:\n\n📝 **Ejemplo de respuesta:**\n"3-5 años, niña, educativos, LEGO, menos de C$300, sí descuentos"\n\n¿Qué buscas?`);
            return;
        }
        
        // Respuesta por defecto
        await message.reply(`Por favor elige una opción:\n• "Comprar" para proceder con la compra\n• "Reservar" para guardar en sucursal\n• "Ver más productos" para continuar buscando\n• "Buscar de nuevo" para cambiar filtros\n• "menú" para volver`);
    }
    
    // Manejar proceso de compra (Cuarta Etapa)
    else if (userContext.get(userId)?.section === 'general' && userContext.get(userId)?.step === 'purchase_process') {
        const context = userContext.get(userId);
        const selectedProduct = context.selectedProduct;
        
        if (content === 'menú' || content === 'menu') {
            userContext.set(userId, { section: 'general', step: 'waiting_choice' });
            await message.reply(`Elige una opción: 1. Consultar precio, 2. Buscar productos, 3. Ver descuentos, 4. Información sucursales, 5. Comprar online.`);
            return;
        }
        
        if (content.toLowerCase().includes('sí') || content.toLowerCase().includes('si') || content.toLowerCase().includes('yes')) {
            // Generar cotización
            const quotation = await generateQuotation(userId, selectedProduct.id, 1);
            
            if (quotation && quotation.success) {
                // Mostrar información detallada del producto
                const productDetails = await getProductWithUpsell(selectedProduct.id);
                
                let detailedInfo = `📋 *Información Detallada - ${selectedProduct.name}*\n\n`;
                detailedInfo += `💰 *Precio:* C$${selectedProduct.price}\n`;
                detailedInfo += `📝 *Descripción:* ${productDetails?.description || selectedProduct.description || 'Juguete de alta calidad'}\n`;
                
                if (productDetails?.age_range) {
                    detailedInfo += `👶 *Edad recomendada:* ${productDetails.age_range} años\n`;
                }
                
                if (productDetails?.brand) {
                    detailedInfo += `🏷️ *Marca:* ${productDetails.brand}\n`;
                }
                
                detailedInfo += `📦 *Stock:* ${productDetails?.total_stock || selectedProduct.stock} unidades\n`;
                
                // Mostrar stock por sucursal si está disponible
                if (productDetails?.store_stock && productDetails.store_stock.length > 0) {
                    detailedInfo += `\n🏪 *Stock por Sucursal:*\n`;
                    productDetails.store_stock.forEach(store => {
                        detailedInfo += `• ${store.name}: ${store.stock} unidades\n`;
                    });
                    detailedInfo += `\n`;
                }
                
                // Mostrar upsell si está disponible
                if (productDetails?.bundle_options && productDetails.bundle_options.length > 0) {
                    detailedInfo += `🔥 *¡Oferta Especial!*\n`;
                    productDetails.bundle_options.forEach(bundle => {
                        detailedInfo += `• Agrega ${bundle.name} por solo +C$${bundle.extra_price}\n`;
                        detailedInfo += `  Total bundle: C$${bundle.total_price}\n`;
                        detailedInfo += `  Ahorras: C$${bundle.savings}\n\n`;
                    });
                }
                
                detailedInfo += `🌐 *Compra Online:* www.toysnicaragua.com/compra/${selectedProduct.id}\n\n`;
                detailedInfo += `**¿Comprar ahora?** Responde 'Sí' para generar cotización o 'No' para cancelar.`;
                
                userContext.set(userId, { 
                    ...context, 
                    step: 'quotation_generation',
                    quotation: quotation.data,
                    waitingFor: 'quotation_confirmation'
                });
                
                await message.reply(detailedInfo);
            } else {
                await message.reply(`Lo sentimos, no se pudo generar la cotización. ¿Quieres que te transfiera a un vendedor para ayudarte?`);
            }
            return;
        }
        
        if (content.toLowerCase().includes('no') || content.toLowerCase().includes('cancelar')) {
            userContext.set(userId, { 
                ...context, 
                step: 'product_detail',
                waitingFor: 'product_action'
            });
            
            await message.reply(`Entendido. ¿En qué más puedo ayudarte?\n\n• "Comprar" para proceder con la compra\n• "Reservar" para guardar en sucursal\n• "Ver más productos" para continuar buscando\n• "menú" para volver`);
            return;
        }
        
        // Respuesta por defecto
        await message.reply(`Por favor responde 'Sí' para proceder con la compra o 'No' para cancelar.`);
    }
    
    // Manejar confirmación de cotización (Cuarta Etapa)
    else if (userContext.get(userId)?.section === 'general' && userContext.get(userId)?.step === 'quotation_generation') {
        const context = userContext.get(userId);
        const quotation = context.quotation;
        
        if (content === 'menú' || content === 'menu') {
            userContext.set(userId, { section: 'general', step: 'waiting_choice' });
            await message.reply(`Elige una opción: 1. Consultar precio, 2. Buscar productos, 3. Ver descuentos, 4. Información sucursales, 5. Comprar online.`);
            return;
        }
        
        if (content.toLowerCase().includes('sí') || content.toLowerCase().includes('si') || content.toLowerCase().includes('yes')) {
            // Enviar cotización PDF y proceder con la compra
            await sendQuotationPDF(message, quotation);
            
            // Solicitar información del cliente
            userContext.set(userId, { 
                ...context, 
                step: 'customer_info',
                waitingFor: 'customer_name'
            });
            
            await message.reply(`👤 *Información del Cliente*\n\nPara proceder con la compra, necesito algunos datos:\n\n¿Cuál es tu nombre completo?`);
            return;
        }
        
        if (content.toLowerCase().includes('no') || content.toLowerCase().includes('cancelar')) {
            userContext.set(userId, { 
                ...context, 
                step: 'product_detail',
                waitingFor: 'product_action'
            });
            
            await message.reply(`Entendido. ¿En qué más puedo ayudarte?\n\n• "Comprar" para proceder con la compra\n• "Reservar" para guardar en sucursal\n• "Ver más productos" para continuar buscando\n• "menú" para volver`);
            return;
        }
        
        // Respuesta por defecto
        await message.reply(`Por favor responde 'Sí' para proceder con la compra o 'No' para cancelar.`);
    }
    
    // Manejar información del cliente (Cuarta Etapa)
    else if (userContext.get(userId)?.section === 'general' && userContext.get(userId)?.step === 'customer_info') {
        const context = userContext.get(userId);
        
        if (content === 'menú' || content === 'menu') {
            userContext.set(userId, { section: 'general', step: 'waiting_choice' });
            await message.reply(`Elige una opción: 1. Consultar precio, 2. Buscar productos, 3. Ver descuentos, 4. Información sucursales, 5. Comprar online.`);
            return;
        }
        
        if (content.toLowerCase().includes('cancelar')) {
            userContext.set(userId, { 
                ...context, 
                step: 'product_detail',
                waitingFor: 'product_action'
            });
            
            await message.reply(`Compra cancelada. ¿En qué más puedo ayudarte?\n\n• "Comprar" para proceder con la compra\n• "Reservar" para guardar en sucursal\n• "Ver más productos" para continuar buscando\n• "menú" para volver`);
            return;
        }
        
        if (context.waitingFor === 'customer_name') {
            // Guardar nombre y solicitar teléfono
            userContext.set(userId, { 
                ...context, 
                customerInfo: { name: content },
                waitingFor: 'customer_phone'
            });
            
            await message.reply(`📞 *Teléfono de Contacto*\n\nGracias ${content}. Ahora necesito tu número de teléfono para contactarte sobre la compra.\n\n¿Cuál es tu número? (formato: +505-1234-5678)`);
            return;
        }
        
        if (context.waitingFor === 'customer_phone') {
            // Guardar teléfono y solicitar sucursal preferida
            userContext.set(userId, { 
                ...context, 
                customerInfo: { ...context.customerInfo, phone: content },
                waitingFor: 'preferred_store'
            });
            
            await message.reply(`🏪 *Sucursal Preferida*\n\nPerfecto. ¿En cuál de nuestras sucursales prefieres recoger tu compra?\n\n1. Camino de Oriente - Módulo B-3\n2. Multicentro Las Américas\n3. Bolonia - Cerca PriceSmart\n4. Metrocentro - Primer nivel\n5. Uniplaza Sur - Km 8\n6. Multicentro Las Brisas\n7. Plaza Once - Carretera Masaya\n8. Galerías Santo Domingo\n\nElige el número o escribe el nombre de la sucursal.`);
            return;
        }
        
        if (context.waitingFor === 'preferred_store') {
            // Guardar sucursal y solicitar método de pago
            const stores = [
                'Camino de Oriente - Módulo B-3',
                'Multicentro Las Américas',
                'Bolonia - Cerca PriceSmart',
                'Metrocentro - Primer nivel',
                'Uniplaza Sur - Km 8',
                'Multicentro Las Brisas',
                'Plaza Once - Carretera Masaya',
                'Galerías Santo Domingo'
            ];
            
            let selectedStore = content;
            if (/^[1-8]$/.test(content)) {
                selectedStore = stores[parseInt(content) - 1];
            }
            
            userContext.set(userId, { 
                ...context, 
                customerInfo: { ...context.customerInfo, store: selectedStore },
                waitingFor: 'payment_method'
            });
            
            // Obtener opciones de pago disponibles
            const paymentOptions = await getPaymentOptions();
            
            let paymentMessage = `💳 *Método de Pago*\n\nExcelente elección: ${selectedStore}\n\n¿Cómo prefieres pagar?\n\n`;
            
            if (paymentOptions && paymentOptions.length > 0) {
                paymentOptions.forEach((option, i) => {
                    paymentMessage += `${i + 1}. ${option.name}${option.description ? ` - ${option.description}` : ''}\n`;
                });
                paymentMessage += `\nElige el número o escribe el método de pago.`;
        } else {
                paymentMessage += `1. Pago en sucursal (efectivo/tarjeta)\n2. Pago online (tarjeta/débito)\n3. Transferencia bancaria\n\nElige el número o escribe el método de pago.`;
            }
            
            await message.reply(paymentMessage);
            return;
        }
        
        if (context.waitingFor === 'payment_method') {
            // Guardar método de pago y crear orden de venta
            userContext.set(userId, { 
                ...context, 
                customerInfo: { ...context.customerInfo, paymentMethod: content },
                waitingFor: 'order_confirmation'
            });
            
            // Crear orden de venta en Odoo
            const saleOrder = await createSaleOrder(userId, context.quotation.id, context.customerInfo);
            
            if (saleOrder && saleOrder.success) {
                // Actualizar inventario
                await updateInventory(context.selectedProduct.id, 1, 'reserve');
                
                let orderConfirmation = `🎉 *¡Orden de Venta Creada Exitosamente!*\n\n`;
                orderConfirmation += `📋 *Orden:* ${saleOrder.data.order_number}\n`;
                orderConfirmation += `👤 *Cliente:* ${context.customerInfo.name}\n`;
                orderConfirmation += `📞 *Teléfono:* ${context.customerInfo.phone}\n`;
                orderConfirmation += `🏪 *Sucursal:* ${context.customerInfo.store}\n`;
                orderConfirmation += `💳 *Pago:* ${context.customerInfo.paymentMethod}\n`;
                orderConfirmation += `💰 *Total:* C$${context.quotation.total_price}\n\n`;
                
                orderConfirmation += `**Próximos pasos:**\n`;
                orderConfirmation += `• Te contactaremos en las próximas 24 horas\n`;
                orderConfirmation += `• Ve a la sucursal con tu número de orden\n`;
                orderConfirmation += `• Paga según el método elegido\n\n`;
                
                orderConfirmation += `🌐 *También puedes pagar online:*\n`;
                orderConfirmation += `www.toysnicaragua.com/pago/${saleOrder.data.order_number}\n\n`;
                
                orderConfirmation += `¿Todo está correcto? Responde 'Sí' para confirmar o 'No' para hacer cambios.`;
                
                userContext.set(userId, { 
                    ...context, 
                    saleOrder: saleOrder.data,
                    waitingFor: 'final_confirmation'
                });
                
                await message.reply(orderConfirmation);
            } else {
                await message.reply(`Lo sentimos, no se pudo crear la orden de venta. ¿Quieres que te transfiera a un vendedor para ayudarte?`);
            }
            return;
        }
        
        if (context.waitingFor === 'final_confirmation') {
            if (content.toLowerCase().includes('sí') || content.toLowerCase().includes('si') || content.toLowerCase().includes('yes')) {
                // Confirmar orden final
                await message.reply(`✅ *¡Orden Confirmada!*\n\nTu compra de ${context.selectedProduct.name} ha sido procesada exitosamente.\n\n📋 **Orden:** ${context.saleOrder.order_number}\n🏪 **Sucursal:** ${context.customerInfo.store}\n💰 **Total:** C$${context.quotation.total_price}\n\nTe contactaremos pronto para coordinar la entrega.\n\n¡Gracias por elegir Toys Nicaragua! 🧸`);
                
                // 🆕 SEXTA ETAPA: Solicitar feedback después de compra exitosa
                setTimeout(async () => {
                    await message.reply(`🎯 *¡Gracias por chatear con Toys!*\n\n¿Todo resuelto? Califica tu experiencia de 1-5 estrellas:\n\n⭐ = Muy malo\n⭐⭐ = Malo\n⭐⭐⭐ = Regular\n⭐⭐⭐⭐ = Bueno\n⭐⭐⭐⭐⭐ = Excelente\n\nResponde con el número de estrellas.`);
                    
                    userContext.set(userId, { 
                        ...context, 
                        step: 'closing_feedback',
                        purchaseCompleted: true
                    });
                }, 3000);
            } else {
                // Cancelar orden
                await message.reply(`❌ *Orden Cancelada*\n\nEntendido. ¿En qué más puedo ayudarte?\n\n• "Comprar" para proceder con la compra\n• "Reservar" para guardar en sucursal\n• "Ver más productos" para continuar buscando\n• "menú" para volver`);
                
                userContext.set(userId, { 
                    ...context, 
                    step: 'product_detail',
                    waitingFor: 'product_action'
                });
            }
            return;
        }
        
        // Respuesta por defecto
        await message.reply(`Por favor proporciona la información solicitada o escribe "cancelar" para cancelar la compra.`);
    }
    
    // 🆕 QUINTA ETAPA: Redirección a Sucursal y Handover
    else if (userContext.get(userId)?.section === 'store_handover' || 
             (userContext.get(userId)?.step === 'store_handover') ||
             (userContext.get(userId)?.step === 'store_selection') ||
             (userContext.get(userId)?.step === 'handover_confirmation') ||
             (userContext.get(userId)?.step === 'agent_conversation')) {
        
        const context = userContext.get(userId);
        
        if (content === 'menú' || content === 'menu') {
        userContext.delete(userId);
            const origin = detectMessageOrigin(message);
            
            if (origin.origin === 'ad') {
                await message.reply(`Responde con: 1. Precio, 2. Stock, 3. Descripción, 4. Otras opciones.`);
                userContext.set(userId, { section: 'ad_response', step: 'waiting_choice' });
            } else {
                await message.reply(`Elige una opción: 1. Consultar precio, 2. Buscar productos, 3. Ver descuentos, 4. Información sucursales, 5. Comprar online.`);
                userContext.set(userId, { section: 'general', step: 'waiting_choice' });
            }
            return;
        }
        
        switch (context.step) {
            case 'store_handover':
                if (message.toLowerCase().includes('hablar con vendedor') || 
                    message.toLowerCase().includes('vendedor') || 
                    message.toLowerCase().includes('sí') || 
                    message.toLowerCase().includes('si')) {
                    
                    // Iniciar proceso de handover
                    userContext.set(userId, { 
                        ...context, 
                        step: 'store_selection',
                        handoverReason: 'solicitud_explicita'
                    });
                    
                    const stores = await getStoreLocations();
                    let storeMessage = '🏪 *Para mejor atención, ¿en qué zona de Managua estás?*\n\n';
                    storeMessage += '(ej. Metrocentro, Linda Vista)\n\n';
                    storeMessage += '*O elige sucursal:*\n\n';
                    
                    stores.forEach((store, index) => {
                        storeMessage += `${index + 1}. *${store.name}*\n`;
                        storeMessage += `   📍 ${store.address}\n`;
                        storeMessage += `   📞 ${store.phone}\n`;
                        storeMessage += `   🕒 ${store.hours}\n\n`;
                    });
                    
                    storeMessage += 'Responde con el número de la sucursal o describe tu ubicación.';
                    
                    await message.reply(storeMessage);
                } else {
                    await message.reply('¿Te gustaría hablar con un vendedor de nuestra sucursal más cercana? Responde "Sí" o "Hablar con vendedor".');
                }
                break;

            case 'store_selection':
                // Procesar selección de sucursal o ubicación
                if (/^\d+$/.test(message.trim())) {
                    // Usuario seleccionó por número
                    const storeIndex = parseInt(message.trim()) - 1;
                    const stores = await getStoreLocations();
                    
                    if (storeIndex >= 0 && storeIndex < stores.length) {
                        const selectedStore = stores[storeIndex];
                        const selectedAgent = selectedStore.agents[0]; // Seleccionar primer agente disponible
                        
                        userContext.set(userId, { 
                            ...context, 
                            selectedStore: selectedStore,
                            selectedAgent: selectedAgent,
                            step: 'handover_confirmation'
                        });
                        
                        await message.reply(`✅ *¡Perfecto! Has seleccionado ${selectedStore.name}*\n\nTe conecto con ${selectedAgent.name} (${selectedAgent.specialty}).\n\nMientras tanto, aquí tienes el link a nuestra web para más productos:\n🌐 www.toysnicaragua.com`);
                        
                        // Crear ticket de handover en Odoo
                        const chatSummary = await generateChatSummary(userId);
                        const handoverTicket = await createHandoverTicket(
                            userId, 
                            selectedStore.id, 
                            selectedAgent.id, 
                            chatSummary, 
                            context.handoverReason || 'transferencia_manual'
                        );
                        
                        if (handoverTicket) {
                            console.log(`Ticket de handover creado: ${handoverTicket.id}`);
                        }
                        
                        // Simular mensaje del agente
                        setTimeout(async () => {
                            const agentMessage = `👨‍💼 *Hola, soy ${selectedAgent.name} de ${selectedStore.name}*\n\n${chatSummary}\n\n¿Cómo puedo ayudarte hoy?`;
                            await message.reply(agentMessage);
                            
                            // Marcar como handover completado
                            userContext.set(userId, { 
                                ...context, 
                                step: 'agent_conversation',
                                handoverCompleted: true,
                                handoverTimestamp: new Date().toISOString()
                            });
                        }, 2000);
                        
                    } else {
                        await message.reply('❌ Número de sucursal inválido. Por favor, elige un número del 1 al 8 o describe tu ubicación.');
                    }
                } else {
                    // Usuario describió ubicación, buscar sucursal más cercana
                    userContext.set(userId, { 
                        ...context, 
                        userLocation: message.trim()
                    });
                    
                    const nearestStore = await findNearestStore(message.trim());
                    userContext.set(userId, { 
                        ...context, 
                        selectedStore: { id: nearestStore.store_id, name: nearestStore.store_name },
                        selectedAgent: { id: nearestStore.agent_id, name: nearestStore.agent_name },
                        step: 'handover_confirmation'
                    });
                    
                    await message.reply(`✅ *¡Perfecto! Basado en tu ubicación*\n\nTe conecto con ${nearestStore.agent_name} de ${nearestStore.store_name}.\n\nMientras tanto, aquí tienes el link a nuestra web:\n🌐 www.toysnicaragua.com`);
                    
                    // Crear ticket de handover en Odoo
                    const chatSummary = await generateChatSummary(userId);
                    const handoverTicket = await createHandoverTicket(
                        userId, 
                        nearestStore.store_id, 
                        nearestStore.agent_id, 
                        chatSummary, 
                        context.handoverReason || 'ubicacion_geografica'
                    );
                    
                    if (handoverTicket) {
                        console.log(`Ticket de handover creado: ${handoverTicket.id}`);
                    }
                    
                    // Simular mensaje del agente
                    setTimeout(async () => {
                        const agentMessage = `👨‍💼 *Hola, soy ${nearestStore.agent_name} de ${nearestStore.store_name}*\n\n${chatSummary}\n\n¿Cómo puedo ayudarte hoy?`;
                        await message.reply(agentMessage);
                        
                        // Marcar como handover completado
                        userContext.set(userId, { 
                            ...context, 
                            step: 'agent_conversation',
                            handoverCompleted: true,
                            handoverTimestamp: new Date().toISOString()
                        });
                    }, 2000);
                }
                break;

            case 'handover_confirmation':
                // Usuario ya confirmó handover, esperar respuesta del agente
                await message.reply('⏳ Te estoy conectando con el vendedor. Por favor, espera un momento...');
                break;

            case 'agent_conversation':
                // Usuario está en conversación con agente
                // Enviar mensaje al agente a través de Odoo
                const routingSuccess = await routeToStore(
                    message, 
                    context.selectedStore.id, 
                    context.selectedAgent.id
                );
                
                if (routingSuccess) {
                    // Mensaje enviado exitosamente al agente
                    await message.reply('✅ Mensaje enviado al vendedor. Te responderá en breve.');
                } else {
                                    // Fallback si el routing falla
                await message.reply('❌ El vendedor no está disponible en este momento. Te contactaremos pronto o puedes visitar nuestra sucursal directamente.');
                
                // 🆕 SEXTA ETAPA: Solicitar feedback antes de cerrar
                setTimeout(async () => {
                    await message.reply(`🎯 *¡Gracias por chatear con Toys!*\n\n¿Todo resuelto? Califica tu experiencia de 1-5 estrellas:\n\n⭐ = Muy malo\n⭐⭐ = Malo\n⭐⭐⭐ = Regular\n⭐⭐⭐⭐ = Bueno\n⭐⭐⭐⭐⭐ = Excelente\n\nResponde con el número de estrellas.`);
                    
                    userContext.set(userId, { 
                        ...context, 
                        step: 'closing_feedback',
                        handoverCompleted: true
                    });
                }, 2000);
                }
                break;

            default:
                // Verificar si han pasado 3 interacciones sin resolución
                if (context.interactionCount >= 3 && !context.handoverCompleted) {
                    // Ofrecer handover automático
                    userContext.set(userId, { 
                        ...context, 
                        step: 'store_handover',
                        handoverReason: 'interacciones_excedidas'
                    });
                    
                    await message.reply('🤔 Parece que necesitas más ayuda. ¿Te gustaría que te conecte con un vendedor de nuestra sucursal más cercana? Responde "Sí" o "Hablar con vendedor".');
                } else {
                    // Respuesta por defecto
                    await message.reply('No entendí tu mensaje. ¿Puedes ser más específico? O responde "Menú" para ver las opciones disponibles.');
                }
                break;
        }
    }
    
    // Volver al menú principal
    else if (content === 'menú' || content === 'menu') {
        userContext.delete(userId);
        const origin = detectMessageOrigin(message);
        
        if (origin.origin === 'ad') {
            await message.reply(`Responde con: 1. Precio, 2. Stock, 3. Descripción, 4. Otras opciones.`);
            userContext.set(userId, { section: 'ad_response', step: 'waiting_choice' });
        } else {
            await message.reply(`Elige una opción: 1. Consultar precio, 2. Buscar productos, 3. Ver descuentos, 4. Información sucursales, 5. Comprar online, 6. Búsqueda avanzada, 7. Hablar con vendedor.`);
            userContexts.set(userId, { section: 'general', step: 'waiting_choice' });
        }
    }
    // 🆕 SEXTA ETAPA: Cierre exitoso y feedback
    else if (userContext?.step === 'closing_feedback') {
        // Manejar feedback del usuario
        if (/^[1-5]$/.test(content.trim())) {
            const rating = parseInt(content.trim());
            
            // Registrar feedback en Odoo
            await recordUserFeedback(userId, rating, '', userContext);
            
            if (rating <= 3) {
                // Feedback negativo, transferir a vendedor
                await message.reply(`😔 Lo sentimos, ¿qué mejoraríamos? Te pasamos a un vendedor para ayudarte mejor.`);
                
                userContexts.set(userId, { 
                    section: 'store_handover', 
                    step: 'store_handover',
                    handoverReason: 'feedback_negativo',
                    feedbackRating: rating
                });
            } else {
                // Feedback positivo
                await message.reply(`🎉 ¡Gracias por tu excelente calificación! Comparte con amigos y familiares sobre Toys Nicaragua.`);
                
                // Ofrecer suscripción al club
                setTimeout(async () => {
                    await message.reply(`🌟 ¿Te gustaría unirte a nuestro club para ofertas exclusivas?\n\nResponde 'Club' para suscribirte y recibir:\n• Descuentos especiales\n• Nuevos productos primero\n• Ofertas exclusivas\n• Eventos especiales`);
                    
                    userContexts.set(userId, { 
                        ...userContext, 
                        step: 'club_subscription',
                        feedbackRating: rating
                    });
                }, 2000);
            }
        } else if (content.toLowerCase().includes('club') || content.toLowerCase().includes('sí') || content.toLowerCase().includes('si')) {
            // Suscribir al club
            const subscription = await subscribeToClub(userId, userContext.customerInfo || {});
            
            if (subscription) {
                await message.reply(`🎉 ¡Bienvenido al Club Toys Nicaragua!\n\nTu suscripción ha sido confirmada. Recibirás ofertas exclusivas y serás el primero en conocer nuevos productos.\n\n¡Gracias por elegirnos! 🧸`);
            } else {
                await message.reply(`🎉 ¡Gracias por tu interés en nuestro club!\n\nTe contactaremos pronto con más información.\n\n¡Que tengas un excelente día! 🧸`);
            }
            
            // Cerrar conversación
            userContexts.delete(userId);
            userData.delete(userId);
        } else {
            await message.reply(`Por favor, califica de 1 a 5 estrellas (1 = muy malo, 5 = excelente) o responde 'Club' para unirte a nuestro club de ofertas exclusivas.`);
        }
    }
    
    // 🆕 SEXTA ETAPA: Club subscription
    else if (userContext?.step === 'club_subscription') {
        if (content.toLowerCase().includes('club') || content.toLowerCase().includes('sí') || content.toLowerCase().includes('si')) {
            // Suscribir al club
            const subscription = await subscribeToClub(userId, userContext.customerInfo || {});
            
            if (subscription) {
                await message.reply(`🎉 ¡Bienvenido al Club Toys Nicaragua!\n\nTu suscripción ha sido confirmada. Recibirás ofertas exclusivas y serás el primero en conocer nuevos productos.\n\n¡Gracias por elegirnos! 🧸`);
            } else {
                await message.reply(`🎉 ¡Gracias por tu interés en nuestro club!\n\nTe contactaremos pronto con más información.\n\n¡Que tengas un excelente día! 🧸`);
            }
            
            // Cerrar conversación
            userContexts.delete(userId);
            userData.delete(userId);
        } else {
            await message.reply(`¿Te gustaría unirte a nuestro club para ofertas exclusivas? Responde 'Club' para suscribirte.`);
        }
    }
    
    // Respuestas para cualquier otra entrada
    else {
        // Verificar si han pasado 2 intentos sin entender
        const context = userContexts.get(userId);
        const failedAttempts = context?.failedAttempts || 0;
        
        if (failedAttempts >= 2) {
            // Ofrecer cierre y feedback después de 2 intentos fallidos
            await message.reply(`🤔 No capté eso. Parece que necesitas ayuda especializada.\n\n¿Te gustaría que te conecte con un vendedor experto? Responde 'Sí' para transferir o 'Menú' para volver al inicio.`);
            
            userContexts.set(userId, { 
                ...context, 
                step: 'offer_escalation',
                failedAttempts: failedAttempts + 1
            });
        } else {
            // Incrementar contador de intentos fallidos
            userContexts.set(userId, { 
                ...context, 
                failedAttempts: failedAttempts + 1 
            });
            
            const humanResponses = [
                '¡Qué pregunta tan interesante! 🤔 Déjame pensar... ¿Te refieres a algún juguete específico o quieres que te ayude con algo en particular?',
                '¡Me encanta tu curiosidad! 😊 ¿Podrías ser más específico? Así puedo ayudarte mejor con información sobre juguetes.',
                '¡Excelente pregunta! 🌟 ¿Te gustaría que te muestre nuestro catálogo o prefieres que te recomiende algo específico?',
                '¡Oh! 🤗 Me gusta cómo piensas. ¿Quieres que exploremos juntos el mundo de los juguetes? Escribe "ayuda" para ver todas las opciones.',
                '¡Qué pregunta tan creativa! 🎨 ¿Te refieres a algún tipo de juguete en particular? Estoy aquí para ayudarte con todo lo relacionado a juguetes.'
            ];
            const randomResponse = humanResponses[Math.floor(Math.random() * humanResponses.length)];
            await message.reply(randomResponse);
        }
    }
    

});

// Webhook para recibir contexto de ads de Meta
const webhookServer = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/webhook/meta') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                
                // Procesar datos del webhook de Meta
                if (data.entry && data.entry[0]?.messaging) {
                    const messaging = data.entry[0].messaging[0];
                    const userId = messaging.sender.id;
                    const adData = messaging.message?.quick_reply?.payload;
                    
                    if (adData) {
                        // Extraer información del ad
                        const adInfo = JSON.parse(adData);
                        adContext.set(userId, {
                            platform: adInfo.platform || 'facebook',
                            productId: adInfo.product_id,
                            productName: adInfo.product_name,
                            timestamp: new Date().toISOString()
                        });
                        
                        console.log(`Contexto de ad almacenado para usuario ${userId}:`, adInfo);
                    }
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok' }));
            } catch (error) {
                console.error('Error procesando webhook:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
    }
});

// Servidor HTTP principal
const PORT = process.env.PORT || 4000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <html>
            <head>
                <title>ToysBot - Tienda de Juguetes</title>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
                    h1 { font-size: 2.5em; margin-bottom: 30px; }
                    .status { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 20px 0; }
                    .emoji { font-size: 2em; }
                    .features { display: flex; justify-content: space-around; margin: 30px 0; }
                    .feature { background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 0 10px; }
                </style>
            </head>
            <body>
                <div class="emoji">🧸</div>
                <h1>ToysBot está funcionando!</h1>
                <div class="status">
                    <p><strong>Puerto:</strong> ${PORT}</p>
                    <p><strong>Estado:</strong> Conectando a WhatsApp...</p>
                    <p><strong>Próximo paso:</strong> Escanea el código QR en la terminal</p>
                </div>
                <div class="features">
                    <div class="feature">
                        <h3>🎯 Detección de Ads</h3>
                        <p>Identifica origen FB/IG</p>
                    </div>
                    <div class="feature">
                        <h3>🔗 Integración Odoo</h3>
                        <p>CRM y seguimiento</p>
                    </div>
                    <div class="feature">
                        <h3>🌍 Multiidioma</h3>
                        <p>Español predeterminado</p>
                    </div>
                </div>
                <p>🎉 Tu bot de juguetes está listo para usar</p>
            </body>
        </html>
    `);
});

// Iniciar servidores
server.listen(PORT, () => {
    console.log(`🌐 Servidor HTTP funcionando en puerto ${PORT}`);
    console.log(`🔗 Abre: http://localhost:${PORT}`);
});

webhookServer.listen(PORT + 1, () => {
    console.log(`🔗 Webhook Meta funcionando en puerto ${PORT + 1}`);
    console.log(`📱 Configura este webhook en Meta Developer Console`);
});

// Iniciar bot
client.initialize();

console.log('🚀 Iniciando ToysBot con detección de ads...');
console.log(`📱 Escanea el código QR que aparecerá en la terminal`);
console.log(`🌐 También puedes abrir: http://localhost:${PORT}`);
console.log(`🔗 Webhook Meta: http://localhost:${PORT + 1}/webhook/meta`);

// Función para generar cotización en Odoo
async function generateQuotation(userId, productId, quantity = 1, additionalProducts = []) {
    try {
        const response = await queryOdoo('whatsapp/generate_quotation', {
            user_id: userId,
            product_id: productId,
            quantity: quantity,
            additional_products: additionalProducts,
            quotation_type: 'whatsapp',
            include_tax: true,
            include_shipping: false
        });
        
        if (response && response.success) {
            return response.data;
        } else {
            console.error('Error generando cotización:', response);
            return null;
        }
    } catch (error) {
        console.error('Error en generateQuotation:', error.message);
        return null;
    }
}

// Función para crear orden de venta en Odoo
async function createSaleOrder(userId, quotationId, customerInfo) {
    try {
        const response = await queryOdoo('whatsapp/create_sale_order', {
            user_id: userId,
            quotation_id: quotationId,
            customer_name: customerInfo.name,
            customer_phone: customerInfo.phone,
            customer_email: customerInfo.email,
            preferred_store: customerInfo.store,
            payment_method: customerInfo.paymentMethod,
            delivery_preference: customerInfo.deliveryPreference
        });
        
        if (response && response.success) {
            return response.data;
        } else {
            console.error('Error creando orden de venta:', response);
            return null;
        }
    } catch (error) {
        console.error('Error en createSaleOrder:', error.message);
        return null;
    }
}

// Función para obtener información detallada del producto con upsell
async function getProductWithUpsell(productId, includeMedia = true) {
    try {
        const response = await queryOdoo('whatsapp/product_with_upsell', {
            product_id: productId,
            include_media: includeMedia,
            include_bundle_options: true,
            include_store_stock: true,
            include_related_products: true
        });
        
        if (response && response.success) {
            return response.data;
        } else {
            console.error('Error obteniendo producto con upsell:', response);
            return null;
        }
    } catch (error) {
        console.error('Error en getProductWithUpsell:', error.message);
        return null;
    }
}

// Función para procesar pago online
async function processOnlinePayment(orderId, paymentMethod, amount) {
    try {
        const response = await queryOdoo('whatsapp/process_payment', {
            order_id: orderId,
            payment_method: paymentMethod,
            amount: amount,
            payment_source: 'whatsapp'
        });
        
        if (response && response.success) {
            return response.data;
        } else {
            console.error('Error procesando pago:', response);
            return null;
        }
    } catch (error) {
        console.error('Error en processOnlinePayment:', error.message);
        return null;
    }
}

// Función para enviar cotización PDF via WhatsApp
async function sendQuotationPDF(message, quotationData) {
    try {
        // Generar PDF de cotización
        const pdfResponse = await queryOdoo('whatsapp/generate_quotation_pdf', {
            quotation_id: quotationData.id,
            include_products: true,
            include_terms: true
        });
        
        if (pdfResponse && pdfResponse.success) {
            // Enviar PDF via WhatsApp
            await message.reply(`📄 *Cotización Generada*\n\nTu cotización está lista. Descárgala aquí:\n${pdfResponse.data.pdf_url}\n\n**Resumen:**\n• Producto: ${quotationData.product_name}\n• Precio: C$${quotationData.total_price}\n• Válido hasta: ${quotationData.valid_until}\n\n¿Quieres proceder con la compra?`);
            return true;
        } else {
            await message.reply(`📄 *Cotización Generada*\n\n**Resumen:**\n• Producto: ${quotationData.product_name}\n• Precio: C$${quotationData.total_price}\n• Válido hasta: ${quotationData.valid_until}\n\n¿Quieres proceder con la compra?`);
            return false;
        }
    } catch (error) {
        console.error('Error enviando cotización PDF:', error.message);
        await message.reply(`📄 *Cotización Generada*\n\n**Resumen:**\n• Producto: ${quotationData.product_name}\n• Precio: C$${quotationData.total_price}\n• Válido hasta: ${quotationData.valid_until}\n\n¿Quieres proceder con la compra?`);
        return false;
    }
}

// Función para actualizar inventario en tiempo real
async function updateInventory(productId, quantity, operation = 'reserve') {
    try {
        const response = await queryOdoo('whatsapp/update_inventory', {
            product_id: productId,
            quantity: quantity,
            operation: operation,
            source: 'whatsapp',
            timestamp: new Date().toISOString()
        });
        
        if (response && response.success) {
            return response.data;
        } else {
            console.error('Error actualizando inventario:', response);
            return null;
        }
    } catch (error) {
        console.error('Error en updateInventory:', error.message);
        return null;
    }
}

// Function to get available payment options from Odoo
async function getPaymentOptions() {
    try {
        const response = await axios.post(`${config.odoo.url}/api/whatsapp/payment_options`, {
            include_online: true,
            include_store: true,
            include_installments: true
        }, {
            headers: {
                'Authorization': `Bearer ${config.odoo.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            return response.data.data;
        } else {
            console.error('Error getting payment options:', response.data.error);
            return getDefaultPaymentOptions();
        }
    } catch (error) {
        console.error('Error calling Odoo payment options API:', error.message);
        return getDefaultPaymentOptions();
    }
}

// Function to get store locations and assign sales agents
async function getStoreLocations() {
    try {
        const response = await axios.post(`${config.odoo.url}/api/whatsapp/store_locations`, {
            include_agents: true,
            include_hours: true,
            include_contact: true
        }, {
            headers: {
                'Authorization': `Bearer ${config.odoo.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            return response.data.data;
        } else {
            console.error('Error getting store locations:', response.data.error);
            return getDefaultStoreLocations();
        }
    } catch (error) {
        console.error('Error calling Odoo store locations API:', error.message);
        return getDefaultStoreLocations();
    }
}

// Function to find nearest store based on location
async function findNearestStore(userLocation) {
    try {
        const response = await axios.post(`${config.odoo.url}/api/whatsapp/find_nearest_store`, {
            user_location: userLocation,
            include_routing: true,
            include_agent_availability: true
        }, {
            headers: {
                'Authorization': `Bearer ${config.odoo.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            return response.data.data;
        } else {
            console.error('Error finding nearest store:', response.data.error);
            return getDefaultNearestStore();
        }
    } catch (error) {
        console.error('Error calling Odoo nearest store API:', error.message);
        return getDefaultNearestStore();
        }
}

// Function to create handover ticket in Odoo CRM
async function createHandoverTicket(userId, storeId, agentId, chatSummary, handoverReason) {
    try {
        const response = await axios.post(`${config.odoo.url}/api/whatsapp/create_handover_ticket`, {
            user_id: userId,
            store_id: storeId,
            agent_id: agentId,
            chat_summary: chatSummary,
            handover_reason: handoverReason,
            timestamp: new Date().toISOString(),
            priority: 'medium',
            status: 'open'
        }, {
            headers: {
                'Authorization': `Bearer ${config.odoo.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            return response.data.data;
        } else {
            console.error('Error creating handover ticket:', response.data.error);
            return null;
        }
    } catch (error) {
        console.error('Error calling Odoo handover ticket API:', error.message);
        return null;
    }
}

// Function to get chat summary for handover
async function generateChatSummary(userId) {
    try {
        const response = await axios.post(`${config.odoo.url}/api/whatsapp/generate_chat_summary`, {
            user_id: userId,
            include_context: true,
            include_products: true,
            include_intent: true,
            max_length: 500
        }, {
            headers: {
                'Authorization': `Bearer ${config.odoo.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            return response.data.data.summary;
        } else {
            console.error('Error generating chat summary:', response.data.error);
            return getDefaultChatSummary(userId);
        }
    } catch (error) {
        console.error('Error calling Odoo chat summary API:', error.message);
        return getDefaultChatSummary(userId);
    }
}

// Function to route message to specific store/agent
async function routeToStore(message, storeId, agentId) {
    try {
        const response = await axios.post(`${config.odoo.url}/api/whatsapp/route_message`, {
            message: message,
            store_id: storeId,
            agent_id: agentId,
            routing_type: 'whatsapp_handover',
            timestamp: new Date().toISOString()
        }, {
            headers: {
                'Authorization': `Bearer ${config.odoo.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            return response.data.data;
        } else {
            console.error('Error routing message:', response.data.error);
            return false;
        }
    } catch (error) {
        console.error('Error calling Odoo routing API:', error.message);
        return false;
    }
}

// Function to get agent availability and contact info
async function getAgentInfo(agentId) {
    try {
        const response = await axios.post(`${config.odoo.url}/api/whatsapp/agent_info`, {
            agent_id: agentId,
            include_availability: true,
            include_contact: true,
            include_specialties: true
        }, {
            headers: {
                'Authorization': `Bearer ${config.odoo.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            return response.data.data;
        } else {
            console.error('Error getting agent info:', response.data.error);
            return getDefaultAgentInfo();
        }
    } catch (error) {
        console.error('Error calling Odoo agent info API:', error.message);
        return getDefaultAgentInfo();
        }
}

// Default fallback functions for store locations
function getDefaultStoreLocations() {
    return [
        {
            id: 1,
            name: "Camino de Oriente",
            address: "Módulo B-3, Centro Comercial Camino de Oriente",
            phone: "+505-1234-5678",
            hours: "9:00 AM - 8:00 PM",
            agents: [
                { id: 1, name: "María González", specialty: "Juguetes Educativos" },
                { id: 2, name: "Carlos Ruiz", specialty: "Construcción y LEGO" }
            ]
        },
        {
            id: 2,
            name: "Metrocentro",
            address: "Local 15, Nivel 1, Metrocentro",
            phone: "+505-1234-5679",
            hours: "10:00 AM - 9:00 PM",
            agents: [
                { id: 3, name: "Ana Martínez", specialty: "Juguetes para Bebés" },
                { id: 4, name: "Luis Herrera", specialty: "Juguetes de Moda" }
            ]
        },
        {
            id: 3,
            name: "Linda Vista",
            address: "Plaza Linda Vista, Local 8",
            phone: "+505-1234-5680",
            hours: "9:00 AM - 7:00 PM",
            agents: [
                { id: 5, name: "Sofia Vargas", specialty: "Juguetes Sostenibles" }
            ]
        },
        {
            id: 4,
            name: "Plaza Inter",
            address: "Local 22, Plaza Inter",
            phone: "+505-1234-5681",
            hours: "9:00 AM - 8:00 PM",
            agents: [
                { id: 6, name: "Roberto Jiménez", specialty: "Juguetes de Mesa" }
            ]
        },
        {
            id: 5,
            name: "Galerías Santo Domingo",
            address: "Local 12, Galerías Santo Domingo",
            phone: "+505-1234-5682",
            hours: "10:00 AM - 9:00 PM",
            agents: [
                { id: 7, name: "Carmen López", specialty: "Juguetes de Exterior" }
            ]
        },
        {
            id: 6,
            name: "Plaza España",
            address: "Local 7, Plaza España",
            phone: "+505-1234-5683",
            hours: "9:00 AM - 7:00 PM",
            agents: [
                { id: 8, name: "Diego Morales", specialty: "Juguetes de Construcción" }
            ]
        },
        {
            id: 7,
            name: "Centro Comercial Managua",
            address: "Local 18, CCM",
            phone: "+505-1234-5684",
            hours: "9:00 AM - 8:00 PM",
            agents: [
                { id: 9, name: "Patricia Rivas", specialty: "Juguetes Educativos" }
            ]
        },
        {
            id: 8,
            name: "Sucursal Central",
            address: "Avenida Bolívar, Frente a la UCA",
            phone: "+505-1234-5685",
            hours: "8:00 AM - 9:00 PM",
            agents: [
                { id: 10, name: "Jorge Silva", specialty: "Gerente de Ventas" },
                { id: 11, name: "Rosa Mendoza", specialty: "Atención al Cliente" }
            ]
        }
    ];
}

// Default fallback for nearest store
function getDefaultNearestStore() {
    return {
        store_id: 8,
        store_name: "Sucursal Central",
        distance: "N/A",
        estimated_time: "5-10 min",
        agent_id: 10,
        agent_name: "Jorge Silva"
    };
}

// Default fallback for chat summary
function getDefaultChatSummary(userId) {
    const userContext = userContexts.get(userId);
    if (!userContext) return "Cliente consultó sobre juguetes";
    
    let summary = `Cliente consultó sobre: `;
    if (userContext.lastProduct) {
        summary += `${userContext.lastProduct.name} `;
    }
    if (userContext.searchFilters) {
        summary += `(filtros: ${JSON.stringify(userContext.searchFilters)}) `;
    }
    summary += `- Estado: ${userContext.step || 'consulta inicial'}`;
    
    return summary;
}

// Default fallback for agent info
function getDefaultAgentInfo() {
    return {
        id: 10,
        name: "Jorge Silva",
        phone: "+505-1234-5685",
        email: "jorge.silva@toysnicaragua.com",
        specialty: "Gerente de Ventas",
        availability: "Disponible",
        store: "Sucursal Central"
    };
}

// Default fallback for payment options
function getDefaultPaymentOptions() {
    return [
        {
            id: 1,
            name: "Pago en Sucursal",
            description: "Efectivo, tarjeta de crédito/débito",
            type: "store",
            available: true
        },
        {
            id: 2,
            name: "Pago Online",
            description: "Tarjeta, PayPal, transferencia bancaria",
            type: "online",
            available: true
        },
        {
            id: 3,
            name: "Transferencia Bancaria",
            description: "Transferencia directa a cuenta bancaria",
            type: "bank_transfer",
            available: true
        }
    ];
}

// Function to record user feedback in Odoo CRM
async function recordUserFeedback(userId, rating, feedback, context) {
    try {
        const response = await axios.post(`${config.odoo.url}/api/whatsapp/record_feedback`, {
            user_id: userId,
            rating: rating,
            feedback: feedback,
            context: context,
            timestamp: new Date().toISOString(),
            source: 'whatsapp'
        }, {
            headers: {
                'Authorization': `Bearer ${config.odoo.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            return response.data.data;
        } else {
            console.error('Error recording feedback:', response.data.error);
            return null;
        }
    } catch (error) {
        console.error('Error calling Odoo feedback API:', error.message);
        return null;
    }
}

// Function to subscribe user to club for exclusive offers
async function subscribeToClub(userId, userInfo) {
    try {
        const response = await axios.post(`${config.odoo.url}/api/whatsapp/subscribe_to_club`, {
            user_id: userId,
            phone: userInfo.phone || userId,
            name: userInfo.name || 'Usuario WhatsApp',
            subscription_type: 'whatsapp_club',
            preferences: {
                notifications: true,
                exclusive_offers: true,
                new_products: true
            },
            timestamp: new Date().toISOString()
        }, {
            headers: {
                'Authorization': `Bearer ${config.odoo.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            return response.data.data;
        } else {
            console.error('Error subscribing to club:', response.data.error);
            return null;
        }
    } catch (error) {
        console.error('Error calling Odoo club subscription API:', error.message);
        return null;
    }
}

// Function to escalate complex queries to human agent
async function escalateComplexQuery(userId, escalationReason, context) {
    try {
        const response = await axios.post(`${config.odoo.url}/api/whatsapp/escalate_query`, {
            user_id: userId,
            escalation_reason: escalationReason,
            context: context,
            priority: 'high',
            timestamp: new Date().toISOString(),
            source: 'whatsapp_auto_escalation'
        }, {
            headers: {
                'Authorization': `Bearer ${config.odoo.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            return response.data.data;
        } else {
            console.error('Error escalating query:', response.data.error);
            return null;
        }
    } catch (error) {
        console.error('Error calling Odoo escalation API:', error.message);
        return null;
    }
}

// Function to log user inactivity
async function logUserInactivity(userId, lastActivity, duration) {
    try {
        const response = await axios.post(`${config.odoo.url}/api/whatsapp/log_inactivity`, {
            user_id: userId,
            last_activity: lastActivity,
            inactivity_duration: duration,
            timestamp: new Date().toISOString()
        }, {
            headers: {
                'Authorization': `Bearer ${config.odoo.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            return response.data.data;
        } else {
            console.error('Error logging inactivity:', response.data.error);
            return null;
        }
    } catch (error) {
        console.error('Error calling Odoo inactivity API:', error.message);
        return null;
    }
}

// Function to get user conversation summary for escalation
async function getConversationSummary(userId) {
    try {
        const response = await axios.post(`${config.odoo.url}/api/whatsapp/conversation_summary`, {
            user_id: userId,
            include_sentiment: true,
            include_intent: true,
            include_products: true,
            include_issues: true,
            max_length: 1000
        }, {
            headers: {
                'Authorization': `Bearer ${config.odoo.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            return response.data.data;
        } else {
            console.error('Error getting conversation summary:', response.data.error);
            return getDefaultConversationSummary(userId);
        }
    } catch (error) {
        console.error('Error calling Odoo conversation summary API:', error.message);
        return getDefaultConversationSummary(userId);
    }
}

// Function to detect complex queries that need escalation
function detectComplexQuery(message, context) {
    const complexKeywords = [
        'queja', 'reclamo', 'problema', 'error', 'defecto', 'roto', 'malo',
        'customización', 'personalizado', 'especial', 'único', 'diferente',
        'complicado', 'difícil', 'no entiendo', 'confuso', 'ayuda urgente',
        'emergencia', 'crítico', 'importante', 'urgente'
    ];
    
    const messageLower = message.toLowerCase();
    const hasComplexKeywords = complexKeywords.some(keyword => 
        messageLower.includes(keyword)
    );
    
    // También escalar si han pasado muchas interacciones sin resolución
    const hasManyInteractions = context && context.interactionCount >= 5;
    
    // Escalar si es una consulta técnica compleja
    const isTechnicalQuery = messageLower.includes('cómo funciona') || 
                            messageLower.includes('instrucciones') ||
                            messageLower.includes('manual') ||
                            messageLower.includes('configuración');
    
    return {
        needsEscalation: hasComplexKeywords || hasManyInteractions || isTechnicalQuery,
        reason: hasComplexKeywords ? 'consulta_compleja' : 
                hasManyInteractions ? 'muchas_interacciones' : 
                isTechnicalQuery ? 'consulta_tecnica' : 'otro'
    };
}

// Function to handle user inactivity timeout
function handleInactivityTimeout(userId, message) {
    const now = Date.now();
    const lastActivity = userData.get(userId)?.lastActivity || now;
    const timeDiff = now - lastActivity;
    
    // Si han pasado más de 5 minutos (300,000 ms)
    if (timeDiff > 300000) {
        // Actualizar última actividad
        userData.set(userId, { 
            ...userData.get(userId), 
            lastActivity: now 
        });
        
        // Log de inactividad
        logUserInactivity(userId, new Date(lastActivity).toISOString(), timeDiff);
        
        return true; // Necesita recordatorio
    }
    
    // Actualizar última actividad
    userData.set(userId, { 
        ...userData.get(userId), 
        lastActivity: now 
    });
    
    return false; // No necesita recordatorio
}

// Default fallback for conversation summary
function getDefaultConversationSummary(userId) {
    const userContext = userContexts.get(userId);
    if (!userContext) return "Cliente inició conversación";
    
    let summary = `Cliente consultó sobre: `;
    if (userContext.lastProduct) {
        summary += `${userContext.lastProduct.name} `;
    }
    if (userContext.searchFilters) {
        summary += `(filtros: ${JSON.stringify(userContext.searchFilters)}) `;
    }
    summary += `- Estado: ${userContext.step || 'consulta inicial'}`;
    
    return summary;
}



