// Configuración del bot Toys
export const config = {
    // Configuración de Odoo
    odoo: {
        baseUrl: process.env.ODOO_URL || 'https://tu-odoo.com',
        apiKey: process.env.ODOO_API_KEY || 'tu-api-key-odoo',
        database: process.env.ODOO_DB || 'tu-database-odoo'
    },
    
    // Configuración de Meta (Facebook/Instagram)
    meta: {
        accessToken: process.env.META_ACCESS_TOKEN || 'tu-meta-access-token',
        appId: process.env.META_APP_ID || 'tu-meta-app-id'
    },
    
    // Configuración del servidor
    server: {
        port: process.env.PORT || 4000,
        webhookPort: process.env.WEBHOOK_PORT || 4001
    },
    
    // Configuración del bot
    bot: {
        name: 'ToysBot',
        language: 'es',
        defaultLanguage: 'es'
    }
};

// Configuración de productos destacados
export const featuredProducts = [
    { id: 1, name: 'LEGO City Policía en Motos', category: 'Construcción' },
    { id: 2, name: 'Barbie Dreamhouse', category: 'Muñecas' },
    { id: 3, name: 'Hot Wheels Ultimate Garage', category: 'Carros' },
    { id: 4, name: 'Nintendo Switch Lite', category: 'Videojuegos' },
    { id: 5, name: 'Play-Doh Kitchen Creations', category: 'Arte' }
];

// Configuración de categorías
export const categories = [
    { id: 'construccion', name: 'Construcción', emoji: '🏗️', keywords: ['lego', 'construcción', 'bloques'] },
    { id: 'munecas', name: 'Muñecas', emoji: '👸', keywords: ['barbie', 'muñeca', 'muñecas'] },
    { id: 'carros', name: 'Carros', emoji: '🚗', keywords: ['hot wheels', 'carro', 'carros'] },
    { id: 'videojuegos', name: 'Videojuegos', emoji: '🎮', keywords: ['nintendo', 'videojuego', 'consola'] },
    { id: 'arte', name: 'Arte', emoji: '🎨', keywords: ['crayola', 'arte', 'creatividad'] },
    { id: 'educativo', name: 'Educativo', emoji: '🧠', keywords: ['educativo', 'fisher', 'aprendizaje'] },
    { id: 'accion', name: 'Acción', emoji: '🎯', keywords: ['acción', 'marvel', 'figuras'] },
    { id: 'exterior', name: 'Exterior', emoji: '🚲', keywords: ['exterior', 'bicicleta', 'deportes'] }
];

// Configuración de promociones
export const promotions = [
    '🔥 2x1 en sets de construcción LEGO',
    '🎁 20% descuento en muñecas Barbie',
    '🚗 Envío gratis en Hot Wheels +$30',
    '🎮 10% descuento en consolas',
    '🎨 3x2 en materiales de arte',
    '🧸 15% descuento en peluches',
    '🚲 Envío gratis en bicicletas',
    '🧠 25% descuento en juguetes educativos'
];

// Configuración de sucursales
export const stores = [
    {
        name: 'Camino de Oriente',
        location: 'Módulo B-3, Centro Comercial Camino de Oriente, Managua',
        hours: 'Lunes a Domingo 9:00 AM - 8:00 PM',
        mapsUrl: 'https://maps.google.com/?q=Camino+de+Oriente+Managua'
    },
    {
        name: 'Multicentro Las Américas',
        location: 'Dentro del centro comercial Multicentro Las Américas, Managua',
        hours: 'Lunes a Domingo 10:00 AM - 9:00 PM',
        mapsUrl: 'https://maps.google.com/?q=Multicentro+Las+Américas+Managua'
    },
    {
        name: 'Bolonia',
        location: 'Colonia Bolonia, cerca de Plaza de PriceSmart Bolonia',
        hours: 'Lunes a Sábado 9:00 AM - 7:00 PM',
        mapsUrl: 'https://maps.google.com/?q=Plaza+PriceSmart+Bolonia+Managua'
    },
    {
        name: 'Metrocentro',
        location: 'Metrocentro Managua, primer nivel',
        hours: 'Lunes a Domingo 10:00 AM - 8:00 PM',
        mapsUrl: 'https://maps.google.com/?q=Metrocentro+Managua'
    },
    {
        name: 'Uniplaza Sur',
        location: 'Kilómetro 8 de la carretera sur, Managua',
        hours: 'Lunes a Domingo 9:00 AM - 8:00 PM',
        mapsUrl: 'https://maps.google.com/?q=Uniplaza+Sur+Managua'
    },
    {
        name: 'Multicentro Las Brisas',
        location: 'Pista Las Brisas, centro comercial Multicentro Las Brisas, Managua',
        hours: 'Lunes a Domingo 9:00 AM - 7:00 PM',
        mapsUrl: 'https://maps.google.com/?q=Multicentro+Las+Brisas+Managua'
    },
    {
        name: 'Plaza Once',
        location: 'Carretera a Masaya, km 11',
        hours: 'Lunes a Domingo 9:00 AM - 8:00 PM',
        mapsUrl: 'https://maps.google.com/?q=Plaza+Once+Carretera+Masaya'
    },
    {
        name: 'Galerías Santo Domingo',
        location: 'Km 7, Carretera a Masaya, Rotonda Jean Paul Genie, Managua',
        hours: 'Lunes a Domingo 10:00 AM - 9:00 PM',
        mapsUrl: 'https://maps.google.com/?q=Galerías+Santo+Domingo+Managua'
    }
];

