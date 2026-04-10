import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import Afip from 'afip-sdk';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // AFIP Integration Endpoint
  app.post('/api/afip/invoice', async (req, res) => {
    const { items, total, paymentMethod, customerCuit, invoiceType } = req.body;

    try {
      // Check if certificates exist
      const certPath = path.join(process.cwd(), 'afip-certs', 'cert.crt');
      const keyPath = path.join(process.cwd(), 'afip-certs', 'key.key');
      const cuit = process.env.AFIP_CUIT;

      if (!fs.existsSync(certPath) || !fs.existsSync(keyPath) || !cuit) {
        return res.status(400).json({ 
          error: 'Configuración de AFIP incompleta. Se requieren certificados y CUIT.',
          details: 'Asegúrate de subir cert.crt y key.key a la carpeta /afip-certs y configurar AFIP_CUIT en las variables de entorno.'
        });
      }

      const afip = new Afip({
        CUIT: parseInt(cuit),
        cert: fs.readFileSync(certPath, 'utf8'),
        key: fs.readFileSync(keyPath, 'utf8'),
        production: process.env.NODE_ENV === 'production'
      });

      // Get last invoice number
      // 1: Factura A, 6: Factura B, 11: Factura C
      const type = invoiceType || 11; 
      const lastVoucher = await afip.ElectronicBilling.getLastVoucher(1, type);
      const nextVoucher = lastVoucher + 1;

      const date = new Date().toISOString().split('T')[0].replace(/-/g, '');

      const data = {
        'CantReg': 1,
        'PtoVta': 1,
        'CbteTipo': type,
        'Concepto': 1, // 1: Products, 2: Services, 3: Both
        'DocTipo': customerCuit ? 80 : 99, // 80: CUIT, 99: Consumidor Final
        'DocNro': customerCuit || 0,
        'CbteDesde': nextVoucher,
        'CbteHasta': nextVoucher,
        'CbteFch': date,
        'ImpTotal': total,
        'ImpTotConc': 0,
        'ImpNeto': total,
        'ImpOpEx': 0,
        'ImpIVA': 0,
        'ImpTrib': 0,
        'MonId': 'PES',
        'MonCotiz': 1,
      };

      const resAfip = await afip.ElectronicBilling.createVoucher(data);

      res.json({
        status: 'success',
        cae: resAfip.CAE,
        caeExpiration: resAfip.CAEFchVto,
        voucherNumber: nextVoucher,
        fullResponse: resAfip
      });

    } catch (error: any) {
      console.error('AFIP Error:', error);
      res.status(500).json({ 
        error: 'Error al conectar con AFIP', 
        details: error.message 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
