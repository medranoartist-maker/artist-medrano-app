// COPIAR EN EL PROYECTO DE APPS SCRIPT ORIGINAL SOLO PARA RESPALDAR DATOS.
// Ejecutar manualmente exportarRespaldoArtistMedrano() como propietario.
// Se guarda un JSON PRIVADO en Google Drive; nunca incluirlo en GitHub.
// Lee la misma propiedad de Script SPREADSHEET_ID de la V4.
function exportarRespaldoArtistMedrano() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Falta SPREADSHEET_ID en Propiedades del script');
  const book = SpreadsheetApp.openById(id);
  const data = {
    exportedAt: new Date().toISOString(),
    sourceSpreadsheetTitle: book.getName(),
    sheets: book.getSheets().map(sheet => ({
      name: sheet.getName(),
      values: sheet.getDataRange().getValues().map(row => row.map(value =>
        value instanceof Date ? value.toISOString() : value
      ))
    }))
  };
  const contents = JSON.stringify(data, null, 2);
  const fileName = 'artist-medrano-respaldo-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmm') + '.json';
  const blob = Utilities.newBlob(contents, 'application/json', fileName);
  const file = DriveApp.createFile(blob);
  Logger.log('Respaldo privado creado en Drive: ' + file.getUrl());
  return file.getUrl();
}
