import { User } from "../models/User.js";
import { initWA } from "./initWA.js";

export async function restoreSessions() {
  try {

    const users = await User.find({
      waStatus: "connected",
    });

    console.log(
      `Restoring ${users.length} WhatsApp sessions`
    );

    for (const user of users) {

      try {

        console.log(
          "Restoring:",
          user.username
        );

        await initWA(user._id.toString());

      } catch (err) {

        console.error(
          "Restore failed:",
          user.username,
          err.message
        );

      }

    }

  } catch (err) {

    console.error(
      "Restore session error:",
      err
    );

  }
}