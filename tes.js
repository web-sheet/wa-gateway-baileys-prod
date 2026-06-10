function testSendWhatsAppNotification() {
   
  const url = "https://websheetapp.my.id/sendMessage";
  
  
  const number  = "6285741255521";  
  const message = "Test Kirim Pesan Ijin";
  
  
  const payload = {
    number: number,   
    message: message,
    delayMin: 2,     
    delayMax: 6       
  };

 
const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-api-key": "f819e04b3c67274eb8ca611f694e15584578752528581321617d4bb6a95e7679"  
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true 
  };

 
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = response.getContentText();
    
    Logger.log("RESPONS SERVER: " + data);
    return data;
    
  } catch (err) {
    Logger.log("TERJADI ERROR: " + err);
    return err.toString();
  }
}