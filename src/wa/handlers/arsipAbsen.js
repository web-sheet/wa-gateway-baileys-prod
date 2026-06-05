//KODE UNTUK LIVE LOCATION
 
    // const isLiveLocation = !!msg.message?.liveLocationMessage;
    // const locationData =
    //   msg.message?.locationMessage || msg.message?.liveLocationMessage;

    // if (locationData) {
    //   // Membersihkan ID pengirim (bisa nomor pribadi atau ID grup)
    //   const sender = from.replace("@s.whatsapp.net", "").replace("@g.us", "");

    //   const latitude = locationData.degreesLatitude;
    //   const longitude = locationData.degreesLongitude;

    //   // Penyesuaian variabel berdasarkan tipe lokasi
    //   let name = "";
    //   let address = "";
    //   let locationType = "static";

    //   if (isLiveLocation) {
    //     locationType = "live";
    //     name = locationData.caption || "Live Location Sharing"; // Menggunakan caption teks jika ada
    //     address = `https://maps.google.com/maps?q=${latitude},${longitude}`; // Generate link maps otomatis
    //   } else {
    //     locationType = "static";
    //     name = locationData.name || "Lokasi Statis";
    //     address =
    //       locationData.address ||
    //       `https://maps.google.com/maps?q=${latitude},${longitude}`;
    //   }

    //   console.log(
    //     `[${locationType.toUpperCase()}] Data dari ${sender}: ${latitude}, ${longitude}, Name: ${name}`,
    //   );

    //   // 🚀 2. KIRIM KE WEBHOOK USER
    //   if (user.webhookUrl) {
    //     try {
    //       await fetch(user.webhookUrl, {
    //         method: "POST",
    //         headers: {
    //           "Content-Type": "application/json",
    //         },
    //         body: JSON.stringify({
    //           type: locationType, // ✨ Tambahan info tipe: "static" atau "live"
    //           sender,
    //           latitude,
    //           longitude,
    //           url: address, // Berisi alamat atau link google maps
    //           name,
    //         }),
    //       });
    //     } catch (webhookErr) {
    //       console.error(
    //         "Gagal mengirim data lokasi ke webhook:",
    //         webhookErr.message,
    //       );
    //     }
    //   }
    // }