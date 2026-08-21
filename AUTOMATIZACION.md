# 🔌 Automatización del formulario → Google Sheets

Guía para conectar el formulario de "PEDIR PRESUPUESTO" de la web con una hoja
de cálculo de Google, **sin servicios de pago ni intermediarios**. Cada
solicitud se insertará automáticamente como una fila nueva en tu Google Sheets.

---

## 1. El código del Google Apps Script

Copia este código completo (lo pegarás en el paso 2):

```javascript
/**
 * JaG — Receptor del formulario de presupuesto
 * ---------------------------------------------
 * Recibe los datos de la web (POST en formato JSON) y los inserta
 * como una fila nueva en la primera hoja de este Google Sheets.
 *
 * Columnas que se rellenan (en este orden):
 * Fecha | Nombre | Correo | Tipo de Negocio | Detalles | Privacidad | Origen
 */
function doPost(e) {
  try {
    // 1. Parseamos el JSON que envía la web (llega como texto plano)
    var data = JSON.parse(e.postData.contents);

    // 2. Abrimos la primera hoja de ESTE archivo de Google Sheets
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // 3. Si la hoja está vacía, creamos la fila de cabeceras primero
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Fecha', 'Nombre', 'Correo', 'Tipo de Negocio',
        'Detalles', 'Privacidad', 'Origen'
      ]);
      // Cabecera en negrita y con fondo dorado suave (opcional, estético)
      sheet.getRange(1, 1, 1, 7)
        .setFontWeight('bold')
        .setBackground('#f3e8cf');
    }

    // 4. Insertamos la solicitud como una fila nueva
    sheet.appendRow([
      new Date(data.fecha || new Date()),  // Fecha del envío
      data.nombre      || '',
      data.correo      || '',
      data.tipoNegocio || '',
      data.detalles    || '',
      data.privacidad  || '',
      data.origen      || ''
    ]);

    // 5. Respondemos OK (la web no puede leerlo por CORS, pero es correcto)
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Si algo falla, lo dejamos registrado para poder depurarlo
    // (Apps Script → Ejecuciones muestra estos errores)
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

> 💡 **Extra opcional:** si quieres recibir también un email de aviso con cada
> solicitud, añade esta línea justo después del `sheet.appendRow([...])` del
> paso 4:
>
> ```javascript
> MailApp.sendEmail('grupojag.contacto@gmail.com',
>   '🔔 Nueva solicitud de presupuesto — ' + data.nombre,
>   'Nombre: '   + data.nombre +
>   '\nCorreo: ' + data.correo +
>   '\nNegocio: '+ data.tipoNegocio +
>   '\nDetalles:\n' + data.detalles);
> ```

---

## 2. Cómo instalarlo (5 minutos)

1. **Abre tu Google Sheets** (o crea uno nuevo en [sheets.new](https://sheets.new))
   y ponle un nombre, por ejemplo: `JaG — Solicitudes de presupuesto`.

2. En el menú superior ve a **Extensiones → Apps Script**.
   Se abrirá el editor de código en una pestaña nueva.

3. **Borra** el contenido de ejemplo (`function myFunction() {...}`) y
   **pega el código completo** del paso 1. Pulsa el icono 💾 (Guardar).

4. Arriba a la derecha pulsa **Implementar → Nueva implementación**.

5. Pulsa el icono del engranaje ⚙️ (junto a "Selecciona el tipo") y elige
   **Aplicación web**. Configúralo así:
   - **Descripción:** `Formulario web JaG` (o lo que quieras)
   - **Ejecutar como:** `Yo` (tu cuenta)
   - **Quién tiene acceso:** `Cualquier usuario` ⚠️ *imprescindible: si no,
     la web no podrá enviar datos*

6. Pulsa **Implementar**. Google te pedirá **autorizar permisos**: acepta con
   tu cuenta (si aparece "app no verificada", pulsa *Configuración avanzada →
   Ir a … (no seguro)* — es tu propio script, es seguro).

7. **Copia la URL de la aplicación web** que te muestra al final
   (termina en `/exec`).

8. Abre `main.js` y pega esa URL en la constante (sección 12 del archivo):

   ```javascript
   const URL_GOOGLE_SHEETS = 'https://script.google.com/macros/s/TU_ID_AQUI/exec';
   ```

9. **Prueba:** recarga la web, envía el formulario y comprueba que aparece la
   fila nueva en tu hoja de cálculo. 🎉

---

## 3. Cosas a tener en cuenta

- **Si modificas el código del script** después de implementarlo, tienes que
  ir a **Implementar → Administrar implementaciones → ✏️ Editar → Versión:
  Nueva versión → Implementar**. Si no, seguirá funcionando la versión antigua.
- La URL `/exec` no cambia entre versiones, así que **no** hace falta volver a
  tocar `main.js`.
- La web envía con `mode: "no-cors"`: es lo normal con Apps Script. Los datos
  llegan correctamente aunque el navegador no pueda leer la respuesta.
- Para depurar errores del lado de Google: editor de Apps Script → menú
  izquierdo → **Ejecuciones** (verás cada llamada y sus errores si los hay).
- Los datos quedan en tu Google Sheets privado: solo tu cuenta tiene acceso,
  tal y como se indica en la política de privacidad de la web.
