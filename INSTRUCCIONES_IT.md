# 🛠️ Instrucciones para Coordinador IT - ToysBot

## 📋 Resumen de Implementación

El bot implementa las siguientes funcionalidades:

1. **Primera Etapa: Saludo y Flujo Inicial**
   - Detección de origen del mensaje (Facebook/Instagram ads vs. general)
   - Saludo personalizado según el origen
   - Confirmación de idioma (español por defecto)
   - Integración con Meta API para contexto de ads
   - Consulta de historial de cliente en Odoo CRM

2. **Segunda Etapa: Consultas Específicas de Ads**
   - Respuestas directas con datos del producto del anuncio
   - Información de precio, stock y descripción desde Odoo
   - Opciones de upsell y productos alternativos
   - Transferencia a agente de ventas si no resuelto

3. **Tercera Etapa: Consultas Generales y Búsquedas Filtradas**
   - Búsqueda avanzada con múltiples filtros (edad, género, categoría, precio, marca)
   - Resultados limitados a 5 productos máximo
   - Sugerencias cuando no hay resultados
   - Promociones por categoría
   - Logging de leads en Odoo CRM

4. **Cuarta Etapa: Resolución y Ventas**
   - Información detallada de productos con opciones de upsell
   - Generación de cotizaciones en Odoo
   - Proceso completo de compra con recolección de datos del cliente
   - Creación de órdenes de venta en Odoo
   - Actualización de inventario en tiempo real
   - Opciones de pago y procesamiento de transacciones
   - Envío de PDF de cotización via WhatsApp

5. **Quinta Etapa: Redirección a Sucursal y Handover** 🆕
   - **Routing inteligente** basado en ubicación geográfica
   - **Transferencia automática** después de 3 interacciones sin resolución
   - **Selección de sucursal** con 8 ubicaciones en Managua
   - **Asignación de agentes** especializados por sucursal
   - **Creación de tickets** de handover en Odoo CRM
   - **Resumen automático** del chat para el vendedor
   - **Routing de mensajes** a agentes específicos

6. **Sexta Etapa: Escalado y Cierre** 🆕
   - **Escalado automático** de consultas complejas (quejas, customización)
   - **Detección inteligente** de consultas que requieren atención especializada
   - **Sistema de feedback** con calificación de 1-5 estrellas
   - **Suscripción al club** para ofertas exclusivas
   - **Manejo de inactividad** con recordatorios después de 5 minutos
   - **Cierre exitoso** con despedida positiva y opciones de seguimiento
   - **Registro de NPS** en Odoo CRM para análisis de satisfacción

**🚨 CRÍTICO para la Cuarta Etapa:**
La implementación de la cuarta etapa requiere **OBLIGATORIAMENTE** la creación de los siguientes endpoints en Odoo:
- `/api/whatsapp/generate_quotation` - Generar cotizaciones
- `/api/whatsapp/create_sale_order` - Crear órdenes de venta
- `/api/whatsapp/product_with_upsell` - Productos con opciones de upsell
- `/api/whatsapp/generate_quotation_pdf` - Generar PDF de cotización
- `/api/whatsapp/update_inventory` - Actualizar inventario
- `/api/whatsapp/payment_options` - Opciones de pago
- `/api/whatsapp/process_payment` - Procesar pagos

**SIN estos endpoints, la funcionalidad de ventas NO funcionará correctamente.**

**🚨 CRÍTICO para la Quinta Etapa:**
La implementación de la quinta etapa requiere **OBLIGATORIAMENTE** la creación de los siguientes endpoints en Odoo:
- `/api/whatsapp/store_locations` - Ubicaciones de sucursales
- `/api/whatsapp/find_nearest_store` - Encontrar sucursal más cercana
- `/api/whatsapp/create_handover_ticket` - Crear tickets de handover
- `/api/whatsapp/generate_chat_summary` - Generar resumen del chat
- `/api/whatsapp/route_message` - Enrutar mensajes a sucursales
- `/api/whatsapp/agent_info` - Información de agentes

**SIN estos endpoints, la funcionalidad de handover y routing NO funcionará correctamente.**

**🚨 CRÍTICO para la Sexta Etapa:**
La implementación de la sexta etapa requiere **OBLIGATORIAMENTE** la creación de los siguientes endpoints en Odoo:
- `/api/whatsapp/record_feedback` - Registrar feedback del usuario
- `/api/whatsapp/subscribe_to_club` - Suscribir usuario al club
- `/api/whatsapp/escalate_query` - Escalar consulta compleja
- `/api/whatsapp/log_inactivity` - Registrar inactividad del usuario
- `/api/whatsapp/conversation_summary` - Resumen de conversación para escalado

**SIN estos endpoints, la funcionalidad de escalado, feedback y cierre NO funcionará correctamente.**

## 🔧 Configuración Requerida

### 1. Variables de Entorno
Crear archivo `.env` en la raíz del proyecto:

```env
# Configuración de Odoo
ODOO_URL=https://tu-odoo.com
ODOO_API_KEY=tu-api-key-odoo
ODOO_DB=tu-database-odoo

# Configuración de Meta (Facebook/Instagram)
META_ACCESS_TOKEN=tu-meta-access-token
META_APP_ID=tu-meta-app-id

# Configuración del servidor
PORT=4000
WEBHOOK_PORT=4001
NODE_ENV=production
```

### 2. Configuración de Meta Developer Console

#### Paso 1: Crear App en Meta
1. Ir a [Meta Developer Console](https://developers.facebook.com/)
2. Crear nueva app o usar existente
3. Agregar producto "WhatsApp Business API"

#### Paso 2: Configurar Webhook
1. En la configuración de la app, ir a "Webhooks"
2. Agregar endpoint: `https://tu-dominio.com:4001/webhook/meta`
3. Verificar token y suscribirse a eventos de mensajes

#### Paso 3: Configurar Ads
1. En Meta Ads Manager, configurar parámetros de tracking
2. Agregar parámetros personalizados:
   - `product_id`: ID del producto
   - `product_name`: Nombre del producto
   - `platform`: facebook o instagram

### 3. Configuración de Odoo (CRÍTICO)

#### Paso 1: Instalar Módulo WhatsApp
1. En Odoo, ir a Apps
2. Buscar e instalar módulo "WhatsApp Integration"
3. Configurar API key en configuración del módulo

#### Paso 2: Configurar Endpoints CRÍTICOS
El módulo debe tener estos endpoints disponibles:

**🔴 OBLIGATORIOS para el funcionamiento del bot:**

1. **`POST /api/products/list`** - Lista de productos
   ```json
   {
     "include_stock": true,
     "include_categories": true,
     "include_descriptions": true
   }
   ```
   **Respuesta esperada:**
   ```json
   {
     "success": true,
     "data": [
       {
         "id": 1,
         "name": "LEGO City Policía en Motos",
         "price": 30.00,
         "category": "Construcción",
         "stock": 15,
         "description": "Set de construcción LEGO con 2 motos...",
         "age_range": "6-12",
         "brand": "LEGO",
         "colors": ["Azul", "Rojo"],
         "features": ["200+ piezas", "Figuras incluidas"]
       }
     ]
   }
   ```

2. **`POST /api/promotions/list`** - Lista de promociones
   ```json
   {
     "active_only": true,
     "include_details": true
   }
   ```
   **Respuesta esperada:**
   ```json
   {
     "success": true,
     "data": [
       {
         "id": 1,
         "title": "🔥 2x1 en sets de construcción LEGO",
         "description": "Lleva 2 sets LEGO por el precio de 1",
         "discount": "50%",
         "valid_until": "2024-12-31",
         "categories": ["Construcción"],
         "products": [1, 2, 3]
       }
     ]
   }
   ```

3. **`POST /api/customer/history`** - Historial del cliente
4. **`POST /api/interaction/log`** - Registrar interacción

**🆕 NUEVOS ENDPOINTS para la Segunda Etapa:**

5. **`POST /api/whatsapp/product_query`** - Consulta detallada de producto
   ```json
   {
     "product_id": 1,
     "include_stock": true,
     "include_images": true,
     "include_alternatives": true,
     "include_upsell": true
   }
   ```
   **Respuesta esperada:**
   ```json
   {
     "success": true,
     "data": {
       "id": 1,
       "name": "LEGO City Policía en Motos",
       "price": 30.00,
       "category": "Construcción",
       "stock": 15,
       "description": "Set de construcción LEGO con 2 motos...",
       "age_range": "6-12",
       "brand": "LEGO",
       "colors": ["Azul", "Rojo"],
       "features": ["200+ piezas", "Figuras incluidas"],
       "image_url": "https://ejemplo.com/foto.jpg",
       "upsell": {
         "name": "LEGO City Comisaría",
         "bundle_price": 50.00
       }
     }
   }
   ```

6. **`POST /api/whatsapp/stock_by_store`** - Stock por sucursal
   ```json
   {
     "product_id": 1
   }
   ```
   **Respuesta esperada:**
   ```json
   {
     "success": true,
     "data": [
       {
         "name": "Camino de Oriente",
         "stock": 5,
         "address": "Módulo B-3, Centro Comercial Camino de Oriente"
       }
     ]
   }
   ```

7. **`POST /api/whatsapp/alternatives`** - Productos alternativos
   ```json
   {
     "product_id": 1,
     "category": "Construcción",
     "limit": 3
   }
   ```
   **Respuesta esperada:**
   ```json
   {
     "success": true,
     "data": [
       {
         "id": 2,
         "name": "LEGO City Comisaría",
         "price": 45.00,
         "description": "Comisaría de policía con figuras incluidas"
       }
     ]
   }
   ```

8. **`POST /api/whatsapp/upsell`** - Recomendaciones de upsell
   ```json
   {
     "product_id": 1,
     "include_bundle_price": true
   }
   ```
   **Respuesta esperada:**
   ```json
   {
     "success": true,
     "data": {
       "name": "LEGO City Comisaría",
       "bundle_price": 50.00,
       "discount": "10%"
     }
   }
   ```

9. **`POST /api/whatsapp/reserve_product`** - Reservar producto
   ```json
   {
     "product_id": 1,
     "user_id": "usuario_whatsapp",
     "quantity": 1,
     "reservation_type": "whatsapp"
   }
   ```
   **Respuesta esperada:**
   ```json
   {
     "success": true,
     "data": {
       "reservation_code": "RES-2024-001",
       "valid_until": "2024-12-31T23:59:59Z",
       "store_name": "Camino de Oriente",
       "store_phone": "+505-1234-5678"
     }
   }
   ```

10. **`POST /api/whatsapp/transfer_to_sales`** - Transferir a vendedor
    ```json
    {
      "user_id": "usuario_whatsapp",
      "product_id": 1,
      "reason": "Consulta específica de producto",
      "timestamp": "2024-01-01T12:00:00Z"
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "store_name": "Camino de Oriente",
        "salesperson_phone": "+505-1234-5678",
        "salesperson_name": "María González",
        "store_hours": "9:00 AM - 8:00 PM"
      }
    }
    ```

**🆕 NUEVOS ENDPOINTS para la Tercera Etapa:**

11. **`POST /api/whatsapp/search_filtered`** - Búsqueda filtrada avanzada
    ```json
    {
      "age_range": "3-5",
      "gender": "niña",
      "category": "educativos",
      "brand": "LEGO",
      "max_price": 300,
      "min_price": 0,
      "has_discounts": true,
      "limit": 5,
      "include_images": true,
      "include_stock": true
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": 1,
          "name": "LEGO Duplo Números",
          "price": 250.00,
          "category": "educativos",
          "stock": 8,
          "description": "Set educativo para aprender números",
          "age_range": "3-5",
          "brand": "LEGO",
          "image_url": "https://ejemplo.com/foto.jpg"
        }
      ]
    }
    ```

12. **`POST /api/whatsapp/search_suggestions`** - Sugerencias de búsqueda
    ```json
    {
      "failed_filters": {
        "age_range": "3-5",
        "category": "educativos",
        "brand": "LEGO"
      },
      "include_trends": true,
      "include_popular": true
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": [
        {
          "reason": "No hay LEGO educativos para 3-5 años",
          "suggestion": "Prueba con Fisher-Price educativos para esa edad"
        }
      ]
    }
    ```

13. **`POST /api/whatsapp/promotions_by_category`** - Promociones por categoría
    ```json
    {
      "category": "educativos",
      "active_only": true,
      "include_codes": true
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": 1,
          "title": "15% off en Educativos",
          "description": "Descuento en juguetes educativos",
          "discount": "15%",
          "code": "TOYS15",
          "valid_until": "2024-12-31"
        }
      ]
    }
    ```

14. **`POST /api/whatsapp/log_search_lead`** - Registrar lead de búsqueda
    ```json
    {
      "user_id": "usuario_whatsapp",
      "search_filters": {
        "age_range": "3-5",
        "category": "educativos"
      },
      "results_count": 3,
      "timestamp": "2024-01-01T12:00:00Z",
      "lead_type": "product_search"
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "lead_id": "LEAD-2024-001",
        "status": "registered"
      }
    }
    ```

**🆕 NUEVOS ENDPOINTS para la Cuarta Etapa:**

15. **`POST /api/whatsapp/generate_quotation`** - Generar cotización
    ```json
    {
      "user_id": "usuario_whatsapp",
      "product_id": 1,
      "quantity": 1,
      "additional_products": [],
      "quotation_type": "whatsapp",
      "include_tax": true,
      "include_shipping": false
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "id": "QUOT-2024-001",
        "product_name": "LEGO Duplo Números",
        "total_price": 250.00,
        "valid_until": "2024-12-31T23:59:59Z",
        "quotation_number": "COT-2024-001"
      }
    }
    ```

16. **`POST /api/whatsapp/product_with_upsell`** - Producto con opciones de upsell
    ```json
    {
      "product_id": 1,
      "include_media": true,
      "include_bundle_options": true,
      "include_store_stock": true,
      "include_related_products": true
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "id": 1,
        "name": "LEGO Duplo Números",
        "description": "Set educativo para aprender números",
        "age_range": "3-5",
        "brand": "LEGO",
        "total_stock": 15,
        "store_stock": [
          {
            "name": "Camino de Oriente",
            "stock": 5
          }
        ],
        "bundle_options": [
          {
            "name": "LEGO Duplo Letras",
            "extra_price": 50.00,
            "total_price": 300.00,
            "savings": 25.00
          }
        ]
      }
    }
    ```

17. **`POST /api/whatsapp/create_sale_order`** - Crear orden de venta
    ```json
    {
      "user_id": "usuario_whatsapp",
      "quotation_id": "QUOT-2024-001",
      "customer_name": "María González",
      "customer_phone": "+505-1234-5678",
      "customer_email": "maria@email.com",
      "preferred_store": "Camino de Oriente",
      "payment_method": "Pago en sucursal",
      "delivery_preference": "Recoger en sucursal"
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "order_number": "SO-2024-001",
        "status": "confirmed",
        "total_amount": 250.00,
        "store": "Camino de Oriente",
        "estimated_delivery": "2024-01-15"
      }
    }
    ```

18. **`POST /api/whatsapp/generate_quotation_pdf`** - Generar PDF de cotización
    ```json
    {
      "quotation_id": "QUOT-2024-001",
      "include_products": true,
      "include_terms": true
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "pdf_url": "https://ejemplo.com/cotizaciones/COT-2024-001.pdf",
        "file_size": "245KB",
        "expires_at": "2024-12-31T23:59:59Z"
      }
    }
    ```

19. **`POST /api/whatsapp/update_inventory`** - Actualizar inventario
    ```json
    {
      "product_id": 1,
      "quantity": 1,
      "operation": "reserve",
      "source": "whatsapp",
      "timestamp": "2024-01-01T12:00:00Z"
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "new_stock": 14,
        "reserved": 1,
        "operation": "reserve",
        "timestamp": "2024-01-01T12:00:00Z"
      }
    }
    ```

20. **`POST /api/whatsapp/payment_options`** - Opciones de pago disponibles
    ```json
    {
      "include_online": true,
      "include_store": true,
      "include_installments": true
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": 1,
          "name": "Pago en Sucursal",
          "description": "Efectivo, tarjeta de crédito/débito",
          "type": "store"
        },
        {
          "id": 2,
          "name": "Pago Online",
          "description": "Tarjeta, PayPal, transferencia",
          "type": "online"
        }
      ]
    }
    ```

21. **`POST /api/whatsapp/process_payment`** - Procesar pago online
    ```json
    {
      "order_id": "SO-2024-001",
      "payment_method": "tarjeta",
      "amount": 250.00,
      "payment_source": "whatsapp"
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "transaction_id": "TXN-2024-001",
        "status": "completed",
        "amount": 250.00,
        "payment_method": "tarjeta",
        "confirmation_number": "CONF-2024-001"
      }
    }
    ```

**🆕 NUEVOS ENDPOINTS para la Quinta Etapa:**

22. **`POST /api/whatsapp/store_locations`** - Ubicaciones de sucursales
    ```json
    {
      "include_agents": true,
      "include_hours": true,
      "include_contact": true
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": 1,
          "name": "Camino de Oriente",
          "address": "Módulo B-3, Centro Comercial Camino de Oriente",
          "phone": "+505-1234-5678",
          "hours": "9:00 AM - 8:00 PM",
          "agents": [
            {
              "id": 1,
              "name": "María González",
              "specialty": "Juguetes Educativos",
              "availability": "Disponible"
            }
          ]
        }
      ]
    }
    ```

23. **`POST /api/whatsapp/find_nearest_store`** - Encontrar sucursal más cercana
    ```json
    {
      "user_location": "Metrocentro, Managua",
      "include_routing": true,
      "include_agent_availability": true
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "store_id": 2,
        "store_name": "Metrocentro",
        "distance": "0.5 km",
        "estimated_time": "5-10 min",
        "agent_id": 3,
        "agent_name": "Ana Martínez",
        "routing_info": {
          "coordinates": "12.1364,-86.2514",
          "transport_mode": "walking"
        }
      }
    }
    ```

24. **`POST /api/whatsapp/create_handover_ticket`** - Crear ticket de handover
    ```json
    {
      "user_id": "usuario_whatsapp",
      "store_id": 1,
      "agent_id": 1,
      "chat_summary": "Cliente consultó sobre LEGO Duplo para 3-5 años",
      "handover_reason": "solicitud_explicita",
      "timestamp": "2024-01-01T12:00:00Z",
      "priority": "medium",
      "status": "open"
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "ticket_id": "TICKET-2024-001",
        "status": "open",
        "assigned_agent": "María González",
        "store": "Camino de Oriente",
        "created_at": "2024-01-01T12:00:00Z"
      }
    }
    ```

25. **`POST /api/whatsapp/generate_chat_summary`** - Generar resumen del chat
    ```json
    {
      "user_id": "usuario_whatsapp",
      "include_context": true,
      "include_products": true,
      "include_intent": true,
      "max_length": 500
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "summary": "Cliente consultó sobre LEGO Duplo Números para 3-5 años. Mostró interés en compra. Estado: quotation_generation. Productos consultados: LEGO Duplo Números (ID: 1).",
        "intent": "purchase",
        "products_mentioned": [1],
        "context": "ad_response"
      }
    }
    ```

26. **`POST /api/whatsapp/route_message`** - Enrutar mensaje a sucursal
    ```json
    {
      "message": "Hola, quiero comprar el LEGO Duplo",
      "store_id": 1,
      "agent_id": 1,
      "routing_type": "whatsapp_handover",
      "timestamp": "2024-01-01T12:00:00Z"
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "routing_id": "ROUTE-2024-001",
        "status": "routed",
        "agent_name": "María González",
        "store_name": "Camino de Oriente",
        "estimated_response_time": "2-5 min"
      }
    }
    ```

27. **`POST /api/whatsapp/agent_info`** - Información del agente
    ```json
    {
      "agent_id": 1,
      "include_availability": true,
      "include_contact": true,
      "include_specialties": true
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "id": 1,
        "name": "María González",
        "phone": "+505-1234-5678",
        "email": "maria.gonzalez@toysnicaragua.com",
        "specialty": "Juguetes Educativos",
        "availability": "Disponible",
        "store": "Camino de Oriente",
        "working_hours": "9:00 AM - 6:00 PM",
        "languages": ["Español", "Inglés"]
      }
    }
    ```

**🆕 NUEVOS ENDPOINTS para la Sexta Etapa:**

28. **`POST /api/whatsapp/record_feedback`** - Registrar feedback del usuario
    ```json
    {
      "user_id": "usuario_whatsapp",
      "rating": 5,
      "feedback": "Excelente atención",
      "context": "compra_completada",
      "timestamp": "2024-01-01T12:00:00Z",
      "source": "whatsapp"
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "feedback_id": "FB-2024-001",
        "rating": 5,
        "nps_score": "Promoter",
        "status": "recorded",
        "timestamp": "2024-01-01T12:00:00Z"
      }
    }
    ```

29. **`POST /api/whatsapp/subscribe_to_club`** - Suscribir usuario al club
    ```json
    {
      "user_id": "usuario_whatsapp",
      "phone": "+505-1234-5678",
      "name": "María González",
      "subscription_type": "whatsapp_club",
      "preferences": {
        "notifications": true,
        "exclusive_offers": true,
        "new_products": true
      },
      "timestamp": "2024-01-01T12:00:00Z"
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "subscription_id": "SUB-2024-001",
        "member_number": "CLUB-001",
        "status": "active",
        "welcome_message": "¡Bienvenido al Club Toys Nicaragua!",
        "next_offer_date": "2024-01-15"
      }
    }
    ```

30. **`POST /api/whatsapp/escalate_query`** - Escalar consulta compleja
    ```json
    {
      "user_id": "usuario_whatsapp",
      "escalation_reason": "consulta_compleja",
      "context": "Cliente consultó sobre customización de juguetes",
      "priority": "high",
      "timestamp": "2024-01-01T12:00:00Z",
      "source": "whatsapp_auto_escalation"
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "escalation_id": "ESC-2024-001",
        "priority": "high",
        "assigned_to": "Equipo Especializado",
        "estimated_response_time": "2-4 horas",
        "status": "open"
      }
    }
    ```

31. **`POST /api/whatsapp/log_inactivity`** - Registrar inactividad del usuario
    ```json
    {
      "user_id": "usuario_whatsapp",
      "last_activity": "2024-01-01T11:55:00Z",
      "inactivity_duration": 300000,
      "timestamp": "2024-01-01T12:00:00Z"
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "log_id": "INACT-2024-001",
        "duration_minutes": 5,
        "reminder_sent": true,
        "status": "logged"
      }
    }
    ```

32. **`POST /api/whatsapp/conversation_summary`** - Resumen de conversación para escalado
    ```json
    {
      "user_id": "usuario_whatsapp",
      "include_sentiment": true,
      "include_intent": true,
      "include_products": true,
      "include_issues": true,
      "max_length": 1000
    }
    ```
    **Respuesta esperada:**
    ```json
    {
      "success": true,
      "data": {
        "summary": "Cliente consultó sobre LEGO Duplo para 3-5 años. Mostró interés en compra pero tuvo dificultades con el proceso. Estado: quotation_generation. Productos consultados: LEGO Duplo Números (ID: 1).",
        "sentiment": "neutral",
        "intent": "purchase",
        "products_mentioned": [1],
        "issues_detected": ["proceso_complejo"],
        "escalation_recommended": true
      }
    }
    ```

#### Paso 3: Estructura de Datos en Odoo
**Productos deben tener estos campos:**
- `id` (entero, único)
- `name` (texto, nombre del producto)
- `price` (decimal, precio en USD)
- `category` (texto, categoría del juguete)
- `stock` (entero, cantidad disponible)
- `description` (texto, descripción detallada)
- `age_range` (texto, rango de edad recomendada)
- `brand` (texto, marca del producto)
- `colors` (array, colores disponibles)
- `features` (array, características del producto)

**Promociones deben tener estos campos:**
- `id` (entero, único)
- `title` (texto, título de la promoción)
- `description` (texto, descripción de la promoción)
- `discount` (texto, descuento aplicado)
- `valid_until` (fecha, validez de la promoción)
- `categories` (array, categorías aplicables)
- `products` (array, productos incluidos)

## 🚀 Despliegue

### 1. Instalación de Dependencias
```bash
npm install
```

### 2. Verificar Configuración
```bash
# Verificar que todas las variables de entorno estén configuradas
node -e "console.log('Configuración:', process.env.ODOO_URL, process.env.META_ACCESS_TOKEN)"
```

### 3. Ejecutar en Producción
```bash
# Usar PM2 para gestión de procesos
npm install -g pm2
pm2 start src/bot-final.js --name "toysbot"
pm2 save
pm2 startup
```

### 4. Configurar Nginx (Opcional)
```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /webhook/meta {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📊 Monitoreo y Logs

### 1. Logs del Bot
```bash
# Ver logs en tiempo real
pm2 logs toysbot

# Ver logs específicos
pm2 logs toysbot --lines 100
```

### 2. Logs del Webhook
```bash
# Ver logs del webhook
tail -f /var/log/nginx/access.log | grep webhook
```

### 3. Métricas Disponibles
- **Puerto 4000**: Dashboard del bot (http://tu-dominio:4000)
- **Puerto 4001**: Webhook de Meta
- **Logs**: Todas las interacciones se registran en consola y Odoo
- **Cache**: Productos y promociones se actualizan cada 30 minutos

## 🔍 Pruebas y Validación

### 1. Probar Detección de Ads
1. Crear anuncio de prueba en Meta Ads Manager
2. Incluir parámetros de tracking
3. Hacer clic en el anuncio
4. Verificar que el webhook reciba datos
5. Confirmar que el bot detecte el origen

### 2. Probar Integración Odoo (CRÍTICO)
1. **Verificar endpoint de productos:**
   ```bash
   curl -X POST https://tu-odoo.com/api/products/list \
     -H "Content-Type: application/json" \
     -d '{"include_stock": true, "include_categories": true, "include_descriptions": true}'
   ```

2. **Verificar endpoint de promociones:**
   ```bash
   curl -X POST https://tu-odoo.com/api/promotions/list \
     -H "Content-Type: application/json" \
     -d '{"active_only": true, "include_details": true}'
   ```

3. Enviar mensaje de prueba al bot
4. Verificar en logs que se registre en Odoo
5. Confirmar en Odoo que la interacción aparezca

**🆕 6. Probar Segunda Etapa - Consultas Específicas de Ads:**
   ```bash
   # Probar consulta detallada de producto
   curl -X POST https://tu-odoo.com/api/whatsapp/product_query \
     -H "Content-Type: application/json" \
     -d '{"product_id": 1, "include_stock": true, "include_images": true, "include_alternatives": true, "include_upsell": true}'
   
   # Probar stock por sucursal
   curl -X POST https://tu-odoo.com/api/whatsapp/stock_by_store \
     -H "Content-Type: application/json" \
     -d '{"product_id": 1}'
   
   # Probar alternativas
   curl -X POST https://tu-odoo.com/api/whatsapp/alternatives \
     -H "Content-Type: application/json" \
     -d '{"product_id": 1, "category": "Construcción", "limit": 3}'
   
   # Probar upsell
   curl -X POST https://tu-odoo.com/api/whatsapp/upsell \
     -H "Content-Type: application/json" \
     -d '{"product_id": 1, "include_bundle_price": true}'
   
   # Probar reserva
   curl -X POST https://tu-odoo.com/api/whatsapp/reserve_product \
     -H "Content-Type: application/json" \
     -d '{"product_id": 1, "user_id": "test_user", "quantity": 1, "reservation_type": "whatsapp"}'
   
   # Probar transferencia
   curl -X POST https://tu-odoo.com/api/whatsapp/transfer_to_sales \
     -H "Content-Type: application/json" \
     -d '{"user_id": "test_user", "product_id": 1, "reason": "Prueba", "timestamp": "2024-01-01T12:00:00Z"}'
   ```

7. **Simular flujo completo de ad:**
   - Enviar mensaje desde ad (con contexto de producto)
   - Preguntar por precio (opción 1)
   - Verificar respuesta con upsell
   - Probar opciones adicionales (stock por sucursal, alternativas, etc.)
   - Verificar transferencia después de múltiples interacciones

**🆕 8. Probar Tercera Etapa - Consultas Generales y Búsquedas Filtradas:**
   ```bash
   # Probar búsqueda filtrada avanzada
   curl -X POST https://tu-odoo.com/api/whatsapp/search_filtered \
     -H "Content-Type: application/json" \
     -d '{"age_range": "3-5", "gender": "niña", "category": "educativos", "brand": "LEGO", "max_price": 300, "has_discounts": true, "limit": 5}'
   
   # Probar sugerencias de búsqueda
   curl -X POST https://tu-odoo.com/api/whatsapp/search_suggestions \
     -H "Content-Type: application/json" \
     -d '{"failed_filters": {"age_range": "3-5", "category": "educativos"}, "include_trends": true}'
   
   # Probar promociones por categoría
   curl -X POST https://tu-odoo.com/api/whatsapp/promotions_by_category \
     -H "Content-Type: application/json" \
     -d '{"category": "educativos", "active_only": true, "include_codes": true}'
   
   # Probar registro de lead
   curl -X POST https://tu-odoo.com/api/whatsapp/log_search_lead \
     -H "Content-Type: application/json" \
     -d '{"user_id": "test_user", "search_filters": {"age_range": "3-5", "category": "educativos"}, "results_count": 3, "lead_type": "product_search"}'
   ```

**🆕 9. Probar Quinta Etapa - Redirección a Sucursal y Handover:**
    ```bash
    # Probar ubicaciones de sucursales
    curl -X POST https://tu-odoo.com/api/whatsapp/store_locations \
      -H "Content-Type: application/json" \
      -d '{"include_agents": true, "include_hours": true, "include_contact": true}'
    
    # Probar búsqueda de sucursal más cercana
    curl -X POST https://tu-odoo.com/api/whatsapp/find_nearest_store \
      -H "Content-Type: application/json" \
      -d '{"user_location": "Metrocentro, Managua", "include_routing": true, "include_agent_availability": true}'
    
    # Probar creación de ticket de handover
    curl -X POST https://tu-odoo.com/api/whatsapp/create_handover_ticket \
      -H "Content-Type: application/json" \
      -d '{"user_id": "test_user", "store_id": 1, "agent_id": 1, "chat_summary": "Prueba", "handover_reason": "test", "timestamp": "2024-01-01T12:00:00Z"}'
    
    # Probar generación de resumen de chat
    curl -X POST https://tu-odoo.com/api/whatsapp/generate_chat_summary \
      -H "Content-Type: application/json" \
      -d '{"user_id": "test_user", "include_context": true, "include_products": true, "include_intent": true}'
    
    # Probar routing de mensajes
    curl -X POST https://tu-odoo.com/api/whatsapp/route_message \
      -H "Content-Type: application/json" \
      -d '{"message": "Prueba", "store_id": 1, "agent_id": 1, "routing_type": "test"}'
    
    # Probar información de agente
    curl -X POST https://tu-odoo.com/api/whatsapp/agent_info \
      -H "Content-Type: application/json" \
      -d '{"agent_id": 1, "include_availability": true, "include_contact": true}'
    ```

**🆕 10. Probar Sexta Etapa - Escalado y Cierre:**
    ```bash
    # Probar registro de feedback
    curl -X POST https://tu-odoo.com/api/whatsapp/record_feedback \
      -H "Content-Type: application/json" \
      -d '{"user_id": "test_user", "rating": 5, "feedback": "Excelente", "context": "test", "timestamp": "2024-01-01T12:00:00Z"}'
    
    # Probar suscripción al club
    curl -X POST https://tu-odoo.com/api/whatsapp/subscribe_to_club \
      -H "Content-Type: application/json" \
      -d '{"user_id": "test_user", "phone": "+505-1234-5678", "name": "Test User", "subscription_type": "test"}'
    
    # Probar escalado de consulta
    curl -X POST https://tu-odoo.com/api/whatsapp/escalate_query \
      -H "Content-Type: application/json" \
      -d '{"user_id": "test_user", "escalation_reason": "test", "context": "Prueba", "timestamp": "2024-01-01T12:00:00Z"}'
    
    # Probar log de inactividad
    curl -X POST https://tu-odoo.com/api/whatsapp/log_inactivity \
      -H "Content-Type: application/json" \
      -d '{"user_id": "test_user", "last_activity": "2024-01-01T11:55:00Z", "inactivity_duration": 300000}'
    
    # Probar resumen de conversación
    curl -X POST https://tu-odoo.com/api/whatsapp/conversation_summary \
      -H "Content-Type: application/json" \
      -d '{"user_id": "test_user", "include_sentiment": true, "include_intent": true}'
    ```

**Pruebas para la Tercera Etapa:**
1. **Búsqueda con filtros múltiples:**
   - Enviar: "Buscar juguetes educativos para niños de 3-5 años, menos de C$300"
   - Verificar: Respuesta con filtros confirmados y resultados limitados a 5
   - Verificar: Log del lead en Odoo CRM

2. **Búsqueda sin resultados:**
   - Enviar: "Buscar juguetes para adultos de 50 años"
   - Verificar: Sugerencia de alternativas y opción de hablar con vendedor

3. **Ver descuentos:**
   - Enviar: "Ver descuentos"
   - Verificar: Lista de promociones activas por categoría

**🆕 Pruebas para la Cuarta Etapa:**
1. **Flujo de compra completo:**
   - Seleccionar producto de búsqueda anterior
   - Responder "comprar" o "reservar"
   - Verificar: Información detallada con upsell y stock por sucursal
   - Confirmar cotización
   - Proporcionar datos del cliente (nombre, teléfono, sucursal, método de pago)
   - Verificar: Creación de orden en Odoo y actualización de inventario
   - Verificar: Envío de PDF de cotización
   - Verificar: Confirmación final con número de orden

2. **Upsell y bundles:**
   - Verificar: Ofertas de productos relacionados
   - Confirmar agregar producto adicional
   - Verificar: Cálculo correcto de precios y descuentos

3. **Reserva de productos:**
   - Verificar: Bloqueo de inventario en Odoo
   - Verificar: Generación de código de reserva
   - Verificar: Opción de cancelación

4. **Opciones de pago:**
   - Verificar: Lista de métodos disponibles
   - Verificar: Integración con sistema de pagos online
   - Verificar: Procesamiento de transacciones

5. **Gestión de errores:**
   - Probar con productos agotados
   - Probar con datos de cliente incompletos
   - Probar fallos en la API de Odoo

**🆕 Pruebas para la Quinta Etapa:**
1. **Handover automático por interacciones:**
   - Realizar 3 interacciones sin resolución
   - Verificar: Oferta automática de handover
   - Confirmar handover y verificar transferencia

2. **Selección de sucursal:**
   - Responder "7. Hablar con vendedor" en menú principal
   - Verificar: Lista de 8 sucursales con información completa
   - Seleccionar por número o describir ubicación
   - Verificar: Asignación de agente y creación de ticket

3. **Routing geográfico:**
   - Describir ubicación: "Estoy en Metrocentro"
   - Verificar: Búsqueda de sucursal más cercana
   - Verificar: Asignación automática de agente

4. **Creación de tickets:**
   - Verificar: Ticket creado en Odoo CRM
   - Verificar: Resumen del chat incluido
   - Verificar: Asignación correcta de agente y sucursal

5. **Conversación con agente:**
   - Verificar: Mensaje de bienvenida del agente
   - Verificar: Resumen del contexto del chat
   - Verificar: Routing de mensajes al agente

6. **Fallbacks y errores:**
   - Probar con agente no disponible
   - Probar fallos en API de Odoo
   - Verificar: Respuestas de fallback apropiadas

**🆕 Pruebas para la Sexta Etapa:**
1. **Escalado automático por consultas complejas:**
   - Enviar: "Tengo una queja sobre el producto"
   - Verificar: Detección automática y escalado inmediato
   - Verificar: Creación de ticket de escalado en Odoo

2. **Sistema de feedback:**
   - Completar compra exitosa
   - Verificar: Solicitud automática de calificación 1-5
   - Probar calificación 1-3: Verificar transferencia a vendedor
   - Probar calificación 4-5: Verificar oferta de club

3. **Suscripción al club:**
   - Responder "Club" después de feedback positivo
   - Verificar: Suscripción creada en Odoo CRM
   - Verificar: Confirmación de bienvenida al club

4. **Manejo de inactividad:**
   - Esperar 5 minutos sin actividad
   - Verificar: Recordatorio automático enviado
   - Verificar: Log de inactividad en Odoo

5. **Cierre forzado por intentos fallidos:**
   - Realizar 2 intentos fallidos de comunicación
   - Verificar: Oferta de escalado a vendedor
   - Verificar: Cierre forzado con solicitud de feedback

6. **Detección de consultas técnicas:**
   - Enviar: "¿Cómo funciona este juguete?"
   - Verificar: Escalado automático por consulta técnica
   - Verificar: Creación de ticket con prioridad alta

### 3. Probar Respuestas del Bot
1. Mensaje vacío → Respuesta de error
2. "Hola" desde ad → Saludo personalizado del producto
3. "Hola" general → Menú completo
4. Opciones del menú → Respuestas contextuales

## 🚨 Solución de Problemas Comunes

### Bot no responde
```bash
# Verificar estado del proceso
pm2 status

# Reiniciar si es necesario
pm2 restart toysbot

# Verificar logs de error
pm2 logs toysbot --err
```

### Webhook no recibe datos
1. Verificar que el puerto 4001 esté abierto
2. Confirmar configuración en Meta Developer Console
3. Verificar logs del webhook
4. Probar endpoint con herramienta como Postman

### Error de conexión con Odoo
1. **Verificar credenciales en variables de entorno**
2. **Confirmar que Odoo esté accesible desde el servidor**
3. **Verificar que el módulo WhatsApp esté instalado**
4. **Verificar que los endpoints de productos y promociones funcionen**
5. Revisar logs de error en Odoo

### Bot no muestra productos
1. **Verificar endpoint `/api/products/list` en Odoo**
2. **Confirmar estructura de respuesta JSON**
3. **Verificar que los productos tengan todos los campos requeridos**
4. Revisar logs del bot para errores de API

### Bot no muestra promociones
1. **Verificar endpoint `/api/promotions/list` en Odoo**
2. **Confirmar estructura de respuesta JSON**
3. **Verificar que las promociones estén activas**
4. Revisar logs del bot para errores de API

## 📈 Escalabilidad

### 1. Múltiples Instancias
```bash
# Crear múltiples instancias del bot
pm2 start src/bot-final.js --name "toysbot-1" -- --port 4000
pm2 start src/bot-final.js --name "toysbot-2" -- --port 4002
pm2 start src/bot-final.js --name "toysbot-3" -- --port 4004
```

### 2. Load Balancer
Configurar Nginx como load balancer entre múltiples instancias.

### 3. Base de Datos
Para mayor escalabilidad, considerar migrar de Map en memoria a:
- Redis para sesiones
- PostgreSQL para datos persistentes
- MongoDB para logs de interacciones

## 🔐 Seguridad

### 1. Firewall
```bash
# Solo abrir puertos necesarios
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 4000  # Bot principal
sudo ufw allow 4001  # Webhook Meta
sudo ufw enable
```

### 2. SSL/TLS
Configurar certificados SSL para el dominio principal y webhook.

### 3. Validación de Webhooks
Implementar validación de firma de Meta para webhooks.

## ⚠️ IMPORTANTE: Configuración de Odoo

**El bot NO funcionará sin la configuración correcta de Odoo:**

1. **Los productos deben venir de Odoo** - no están hardcodeados
2. **Las promociones deben venir de Odoo** - no están hardcodeadas
3. **El cache se actualiza cada 30 minutos** para mantener datos frescos
4. **Si Odoo no responde, el bot usará cache anterior** (si existe)
5. **Sin cache previo, el bot no podrá mostrar productos**

**🆕 CRÍTICO para la Segunda Etapa:**

6. **Los nuevos endpoints de WhatsApp deben estar implementados** en Odoo:
   - `/api/whatsapp/product_query` - Consulta detallada con upsell
   - `/api/whatsapp/stock_by_store` - Stock por sucursal
   - `/api/whatsapp/alternatives` - Productos alternativos
   - `/api/whatsapp/upsell` - Recomendaciones de upsell
   - `/api/whatsapp/reserve_product` - Reservas de productos
   - `/api/whatsapp/transfer_to_sales` - Transferencia a vendedores

7. **Sin estos endpoints, la segunda etapa NO funcionará** y el bot solo podrá manejar consultas básicas

8. **El sistema de upsell requiere reglas configuradas** en el CRM de Odoo basadas en:
   - Historial de compras
   - Categorías relacionadas
   - Productos frecuentemente comprados juntos
   - Reglas de descuento por bundle

**🆕 CRÍTICO para la Tercera Etapa:**

9. **Los nuevos endpoints de búsqueda avanzada deben estar implementados** en Odoo:
   - `/api/whatsapp/search_filtered` - Búsqueda con múltiples filtros
   - `/api/whatsapp/search_suggestions` - Sugerencias inteligentes
   - `/api/whatsapp/promotions_by_category` - Promociones por categoría
   - `/api/whatsapp/log_search_lead` - Registro de leads de búsqueda

10. **Sin estos endpoints, la búsqueda avanzada NO funcionará** y el bot solo podrá manejar búsquedas básicas

11. **El sistema de sugerencias requiere análisis de datos** en Odoo basado en:
    - Productos más populares por categoría
    - Tendencias de búsqueda
    - Productos frecuentemente consultados juntos
    - Análisis de búsquedas fallidas

## 📞 Contacto y Soporte

Para soporte técnico adicional:
- Revisar logs del sistema
- Verificar configuración de variables de entorno
- **Verificar endpoints de Odoo funcionando**
- Consultar documentación de Meta API y Odoo
- Contactar al equipo de desarrollo

---

**Nota**: Este bot está configurado para funcionar específicamente con la tienda Toys Nicaragua. **El catálogo de productos y promociones se obtiene dinámicamente de Odoo en tiempo real**, por lo que la configuración de Odoo es crítica para el funcionamiento del sistema.
