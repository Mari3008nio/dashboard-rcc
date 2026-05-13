# RC&C Dashboard — Frontend

Panel de administración para RC&C Refrigeración, Climas y Construcción.

## Stack

- React 19 + Vite
- Lucide React (íconos)
- html2pdf.js (generación de PDFs en el navegador)

## Vistas

- **Inicio** — Historial de cotizaciones generadas
- **Nueva Cotización** — Formulario con cálculo automático de IVA y exportación a PDF
- **Clientes** — Directorio con CRUD completo
- **Servicios y Precios** — Catálogo editable

## Comandos

```bash
npm install
npm run dev        # desarrollo (usa .env.local)
npm run build      # producción (usa .env.production)
```

## Variables de entorno

| Variable        | Descripción                        |
| --------------- | ---------------------------------- |
| `VITE_API_URL`  | URL base del backend               |
| `VITE_APP_NAME` | Nombre que aparece en el navegador |
