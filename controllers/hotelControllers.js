// routes/text.js
const express = require("express");
const { check, validationResult } = require("express-validator");
const Text = require("../models/hotelSchema");
const User = require("../models/userSchema"); // Assurez-vous d'importer le modèle utilisateur
const authenticateToken = require("../middleware/verifyToken");
const router = express.Router();

const multer = require("multer");

// Configuration de multer pour le téléchargement des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

router.post(
  "/",
  [
    authenticateToken,
    upload.single("image"),
    check("nameHotel", "Le nom de l'hôtel est requis").not().isEmpty(),
    check("email", "Un email valide est requis").isEmail(),
    check("address", "L'adresse est requise").not().isEmpty(),
    check("price", "Le prix est requis").not().isEmpty(),
    check("number", "Le numéro de téléphone est requis").not().isEmpty(),
    check("devise", "La devise est requise").not().isEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({ msg: "Utilisateur non trouvé" });
      }

      const newText = new Text({
        user: req.user.id,
        nameHotel: req.body.nameHotel,
        email: req.body.email,
        address: req.body.address,
        price: req.body.price,
        number: req.body.number,
        devise: req.body.devise,
        image: `${req.protocol}://${req.get("host")}/uploads/${
          req.file.filename
        }`,
      });

      const text = await newText.save();
      res.json(text);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Erreur du serveur");
    }
  }
);

// Obtenir tous les textes de l'utilisateur connecté
router.get("/", authenticateToken, async (req, res) => {
  try {
    const texts = await Text.find({ user: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(texts);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erreur du serveur");
  }
});

// Mettre à jour un hotel
router.put(
  "/:id",
  authenticateToken,
  upload.single("image"),

  [
    check("email", "Un email valide est requis").isEmail(),
    check("nameHotel", "Le nom de l'hôtel est requis").not().isEmpty(),
    check("address", "L'adresse est requise").not().isEmpty(),
    check("price", "Le prix est requis").not().isEmpty(),
    check("number", "Le numéro de téléphone est requis").not().isEmpty(),
    check("devise", "La devise est requise").not().isEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      let text = await Text.findById(req.params.id);
      if (!text) {
        return res.status(404).json({ msg: "Texte non trouvé" });
      }

      if (text.user.toString() !== req.user.id) {
        return res.status(401).json({ msg: "Non autorisé" });
      }

      text = await Text.findByIdAndUpdate(
        req.params.id,
        {
          email: req.body.email,
          nameHotel: req.body.nameHotel,
          address: req.body.address,
          price: req.body.price,
          number: req.body.number,
          devise: req.body.devise,
          image: `${req.protocol}://${req.get("host")}/uploads/${
            req.file.filename
          }`,
        },
        { new: true }
      );

      res.json(text);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Erreur du serveur");
    }
  }
);

// Supprimer un texte
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    let text = await Text.findById(req.params.id);
    if (!text) {
      return res.status(404).json({ msg: "Texte non trouvé" });
    }

    // Vérifier si l'utilisateur connecté est le propriétaire du texte
    if (text.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Non autorisé" });
    }

    await Text.findByIdAndDelete(req.params.id);

    res.json({ msg: "Texte supprimé" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erreur du serveur");
  }
});

module.exports = router;
