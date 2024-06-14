const express = require("express");
const User = require("../models/userSchema");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const router = express.Router();
const auth = require("../middleware/verifyToken");
const upload = require("../middleware/multer");

// Inscription
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: "L'utilisateur existe déjà" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({ name, email, password: hashedPassword });
    await user.save();

    const payload = { user: { id: user.id } };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 86400 },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erreur du serveur");
  }
});

// Connexion
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Identifiants invalides" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Identifiants invalides" });
    }

    const payload = { user: { id: user.id } };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 86400 },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erreur du serveur");
  }
});

// Obtenir l'utilisateur
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erreur du serveur");
  }
});

// Upload de l'image de profil
router.post(
  "/updateProfileImage",
  auth,
  upload.single("profileImage"),
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).send("Utilisateur non trouvé");
      }

      if (!req.file) {
        return res.status(400).send("Aucun fichier téléchargé");
      }

      user.profileImageUrl = `${req.protocol}://${req.get("host")}/uploads/${
        req.file.filename
      }`;
      await user.save();

      res.send({ profileImageUrl: user.profileImageUrl });
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Erreur du serveur");
    }
  }
);

// Afficher le profil de l'utilisateur
router.get("/profile/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const userProfileImage = await User.findById(userId).select(
      "profileImageUrl"
    );

    if (!userProfileImage) {
      return res.status(404).json({ msg: "Utilisateur non trouvé" });
    }

    const profileImageUrl = userProfileImage.profileImageUrl;

    res.json({ profileImageUrl });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erreur du serveur");
  }
});

function sendResetPasswordEmail(user, token) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "piodlords03@gmail.com",
      pass: "cqce yoyv sbje mvim",
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: "Réinitialisation de mot de passe",
    text: `Bonjour ${user.name},

    Vous avez demandé une réinitialisation de mot de passe. Veuillez cliquer sur le lien ci-dessous pour réinitialiser votre mot de passe :
    
    http://localhost:3000/gmailPwd/${token}
    
    Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet e-mail.

    Cordialement,
    RED PRODUCT`,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email envoyé: " + info.response);
    }
  });
}

// Contrôleur pour la demande de réinitialisation de mot de passe
router.post("/forgotPassword", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé !" });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.RESET_PASSWORD_SECRET,
      {
        expiresIn: "1h", // Durée de validité du token de réinitialisation
      }
    );

    sendResetPasswordEmail(user, token);

    res.status(200).json({
      message: "Un e-mail de réinitialisation de mot de passe a été envoyé.",
    });
  } catch (error) {
    console.error("Error during forgot password:", error);
    res.status(500).json({
      error:
        "Une erreur s'est produite lors de la demande de réinitialisation de mot de passe.",
    });
  }
});

// Contrôleur pour la soumission du formulaire de réinitialisation de mot de passe
router.post("/resetPassword", async (req, res) => {
  try {
    const { token, password } = req.body;
    const decoded = jwt.verify(token, process.env.RESET_PASSWORD_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé !" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Mot de passe réinitialisé avec succès." });
  } catch (error) {
    console.error("Error during reset password:", error);
    res.status(500).json({
      error:
        "Une erreur s'est produite lors de la réinitialisation du mot de passe.",
    });
  }
});

module.exports = router;
