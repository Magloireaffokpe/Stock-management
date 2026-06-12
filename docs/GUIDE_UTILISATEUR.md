# 📖 Guide d'Utilisation Simplifié — MICROLOGIS Stock Manager

Bienvenue dans **MICROLOGIS Stock Manager** ! Ce guide a été conçu spécialement pour vous aider à prendre en main l'application, même si vous n'avez pas de connaissances techniques.

L'objectif de ce logiciel est de vous simplifier la vie : vous enregistrez vos produits, vous faites vos ventes, et **le logiciel s'occupe de calculer et de mettre à jour votre stock automatiquement**. Fini les erreurs de comptage sur papier !

---

## 🚀 1. Démarrage et Connexion

### Comment lancer l'application ?
Si l'application est installée sur votre ordinateur Windows, il vous suffit de double-cliquer sur le fichier nommé **`start.bat`**. 
Deux petites fenêtres noires vont s'ouvrir (ne les fermez pas, c'est le moteur du logiciel !), puis votre navigateur internet s'ouvrira tout seul sur la page de connexion.

> 📌 **Ce que vous voyez :** Deux fenêtres noires s’ouvrent (l’une pour le serveur, l’autre pour l’interface). Votre navigateur (Chrome, Edge...) s’ouvre ensuite automatiquement sur une page blanche avec un logo **MICROLOGIS**, un champ *Nom d’utilisateur* et un champ *Mot de passe*.

### Se connecter
Entrez votre **Nom d'utilisateur** et votre **Mot de passe**.
*   **Si vous êtes Administrateur (Gérant)** : Vous aurez accès à tout (paramètres, rapports financiers, gestion des employés).
*   **Si vous êtes Employé (Vendeur)** : Vous aurez accès aux ventes, au catalogue et à l'historique, mais vous ne pourrez pas modifier les réglages sensibles de la boutique.

> 🔑 **Identifiants du compte administrateur (installés par votre technicien) :**
> | Champ | Valeur |
> |---|---|
> | Nom d'utilisateur | `admin` |
> | Mot de passe | `micrologis2026` |
>
> ⚠️ **Ce compte est réservé au gérant (Admin).** Les comptes des vendeurs/employés sont créés par l'admin dans **Paramètres → Utilisateurs**, avec un nom d'utilisateur et mot de passe personnalisé.
>
> 🔒 **L'admin doit changer ce mot de passe dès la première connexion** (voir section 9 ci-dessous).

---

## 📊 2. Le Tableau de Bord (La page d'accueil)

C'est la première page que vous voyez en vous connectant. C'est le "centre de contrôle" de votre boutique.
Vous y trouverez en un clin d'œil :
*   **L'argent gagné aujourd'hui** (Chiffre d'affaires).
*   **Le nombre de ventes réalisées**.
*   **Les alertes de stock** : Le logiciel vous prévient en rouge ou en orange si des produits sont presque épuisés ou en rupture de stock.
*   **Les dernières ventes** effectuées dans la journée.

> 📌 **Ce que vous voyez :** Une page avec des grandes cartes colorées affichant des chiffres (0 F au départ). En haut à droite, une cloche indique les alertes de stock. La barre de navigation sur la gauche liste toutes les sections du logiciel.

---

## 📦 3. Le Catalogue : Ajouter et gérer ses produits

Avant de pouvoir vendre, il faut que le logiciel connaisse vos produits. Tout se passe dans l'onglet **Catalogue produits** (menu sur la gauche).

### Étape A : Créer un Fournisseur (Optionnel mais recommandé)
Dans le menu, allez dans **Fournisseurs**. Cliquez sur "Nouveau fournisseur". Renseignez le nom de la personne ou de l'entreprise qui vous livre la marchandise (et son contact).

### Étape B : Ajouter un nouveau produit
Allez dans **Catalogue produits** et cliquez sur le bouton bleu **"Nouveau produit"**.

Remplissez le formulaire. Voici les informations les plus importantes :
1.  **Nom du produit** : Par exemple "Ordinateur HP ProBook".
2.  **Catégorie** : Choisissez la famille du produit (PC, Téléphone, Accessoires...).
3.  **Prix d'achat** : Combien le produit vous a coûté (cela reste secret pour les vendeurs, seul l'admin peut le voir pour calculer les bénéfices).
4.  **Prix de vente** : Le prix payé par le client à la caisse.
5.  **Quantité initiale (Stock)** : Combien vous en avez en boutique au moment où vous créez le produit.
6.  **Seuil d'alerte** : C'est très important ! Si vous mettez "5", le logiciel vous alertera dès qu'il ne restera plus que 5 exemplaires en boutique pour que vous pensiez à recommander.

**Et c'est tout !** Cliquez sur "Enregistrer". Votre produit est prêt à être vendu.

> 📌 **Ce que vous voyez :** Un formulaire avec plusieurs champs à remplir. Les champs obligatoires sont en gras. Si vous oubliez un champ, le logiciel vous le signale en rouge — impossible d’enregistrer un produit incomplet. Le bouton **Enregistrer** est en bleu en bas.

---

## 🛒 4. Faire une Vente (Le Point de Vente)

C'est ici que vous allez passer le plus de temps. Cliquez sur **Point de vente** dans le menu de gauche. L'écran est divisé en deux : à gauche vos produits, à droite le panier du client.

### Comment vendre ?
1.  **Trouver le produit** : Utilisez la barre de recherche ou cliquez sur la photo du produit. *(Note : Seuls les produits qui sont réellement en stock s'affichent !)*
2.  **Ajouter au panier** : Cliquez sur le produit. Il s'ajoute sur la droite. Vous pouvez augmenter la quantité (si le client en achète 2 ou 3) avec les boutons `+` et `-`.
3.  **Le Client (Optionnel)** : Vous pouvez sélectionner un client enregistré ou taper le nom d'un nouveau client. C'est pratique pour retrouver ses factures plus tard.
4.  **Encaisser** : Cliquez sur le gros bouton vert "Encaisser". 
5.  **Choisir le moyen de paiement** : Le client paie-t-il en Espèces ? Par Carte ? Ou par Mobile Money (Celtiis Money) ? Sélectionnez la bonne option et validez.

> 📌 **Ce que vous voyez :** À gauche, une grille de produits avec leur photo, nom et prix. À droite, un panneau "Panier" vide au départ. Cliquez sur un produit : il apparaît dans le panier et le total se calcule tout seul. Le bouton **Encaisser** est en vert en bas à droite.

> **💡 Que se passe-t-il en arrière-plan ("La Magie du logiciel") ?**
> Dès que vous cliquez sur "Valider la vente", le logiciel travaille tout seul :
> *   Il crée une belle facture que vous pouvez imprimer.
> *   Il enregistre l'argent dans le chiffre d'affaires du jour.
> *   **Le plus important : Il diminue le stock automatiquement !** Si vous aviez 10 ordinateurs et que vous venez d'en vendre 1, le logiciel met le stock à 9 instantanément. Personne n'a besoin de faire le calcul.

### Et si le client veut juste un Devis ?
Au lieu de cliquer sur "Encaisser", cliquez sur **"Créer un devis"**. Cela n'enlève aucun produit du stock, ça génère juste un document avec les prix à remettre au client. Si le client revient 3 jours plus tard avec l'argent, vous pourrez transformer ce devis en vente en un seul clic !

---

## 🚚 5. Les Réapprovisionnements (Ajouter du nouveau stock)

Quand votre livreur arrive avec de la nouvelle marchandise, vous ne devez **pas** recréer le produit ni modifier le chiffre à la main. Vous devez utiliser la fonction **Réapprovisionnements**.

1.  Allez dans le menu **Réapprovisionnements**.
2.  Cliquez sur **Nouveau Réapprovisionnement**.
3.  Cherchez le produit que vous venez de recevoir.
4.  Indiquez la **quantité reçue** (par exemple : 20).
5.  Validez.

> **💡 Que se passe-t-il en arrière-plan ?**
> Le logiciel prend vos anciens produits restants (ex: 3), ajoute les nouveaux (20), et met à jour votre stock total (23). Il garde aussi une trace de la date et de qui a fait cette entrée en stock.

> 📌 **Ce que vous voyez :** Un formulaire simple avec un champ de recherche de produit et un champ quantité. Tapez le nom du produit reçu, entrez la quantité, et cliquez Valider. Le stock se met à jour immédiatement.

---

## 🕵️ 6. Historique et Mouvements de Stock (La Traçabilité)

Où vont les produits ? D'où viennent-ils ? Le logiciel note absolument **tout**.

Allez dans **Mouvements de stock**. Vous y verrez un grand tableau chronologique.
C'est comme le journal intime de votre boutique :
*   *Le 12 Juin à 10h15 : +20 articles (Réapprovisionnement)*
*   *Le 12 Juin à 11h30 : -1 article (Vente au client Dupont)*
*   *Le 12 Juin à 14h00 : +1 article (Annulation de la vente Dupont, le produit revient en rayon)*

Chaque ligne a un numéro (une référence en bleu ou en vert). Si vous cliquez dessus, vous verrez exactement la facture ou le bon de livraison correspondant. Impossible de perdre la trace d'un article !

> 📌 **Ce que vous voyez :** Un grand tableau avec des colonnes : Date, Type (Vente / Réappro / Ajustement), Produit, Quantité (en vert si entrée, en rouge si sortie), Stock avant, Stock après, Référence. Cliquez sur la référence en bleu pour voir la facture associée.

---

## 📈 7. Rapports et Analyses (Pour le Gérant)

Le menu **Rapports & Analyses** est le meilleur ami de l'administrateur.
C'est ici que vous voyez la santé financière de l'entreprise sous forme de beaux graphiques :
*   **Graphique en anneau (Le Camembert)** : Il vous montre quelles catégories de produits vous rapportent le plus d'argent. Passez votre souris sur les couleurs pour voir les montants exacts et les pourcentages.
*   **Top Produits** : Le classement de vos meilleures ventes.
*   **Évolution** : Des courbes pour comparer les mois entre eux.

Vous pouvez aussi utiliser cette page pour exporter (télécharger sur Excel) la liste complète de vos ventes pour faire votre comptabilité.

> 📌 **Ce que vous voyez :** Un tableau de bord avec des graphiques colorisés. Un "camembert" montre la répartition des ventes par catégorie. Un graphique en barres montre les ventes jour par jour. Un classement liste vos 10 meilleurs produits. Passez la souris sur les graphiques pour voir les chiffres exacts.

---

## 👤 9. Mon Profil — Changer son mot de passe

Cette section est accessible à **tous** : admin ET employé.

### Comment y accéder ?
En bas à gauche de l'application, vous voyez votre nom et la mention **« Mon profil »**.
Cliquez dessus — ou allez directement dans le menu **Mon Profil**.

### Ce que vous pouvez faire
1. **Modifier votre prénom, nom, e-mail** — dans l'onglet *Informations*.
2. **Changer votre mot de passe** — dans l'onglet *Mot de passe* :
   - Entrez votre nouveau mot de passe (minimum 6 caractères).
   - Répétez-le pour confirmer.
   - Cliquez sur **Changer le mot de passe**.
   - Une barre colorée vous indique si votre mot de passe est faible, moyen ou robuste.

> 💡 **Conseil de sécurité :** Utilisez un mot de passe d'au moins 8 caractères mêlant lettres et chiffres. Changez-le régulièrement.

> 📌 **Ce que vous voyez :** Une page avec votre avatar (vos initiales) à gauche, et deux onglets à droite : *Informations* et *Mot de passe*. La validation se fait en temps réel — si les deux mots de passe ne correspondent pas, le logiciel vous le dit avant même que vous cliquiez.

---

## ⚙️ 10. Paramètres et Lexique

### Paramètres de la boutique
Dans le menu **Paramètres** (réservé à l'administrateur), vous pouvez :
*   Changer le nom de la boutique.
*   Mettre votre propre logo (qui s'affichera en haut à gauche et sur les factures).
*   Changer la couleur principale du logiciel (bleu, vert, rouge... comme vous préférez !).
*   Faire des sauvegardes manuelles de toutes vos données pour ne rien perdre en cas de problème avec l'ordinateur.

### Le Lexique
Vous voyez un terme bizarre (comme *ORD*, *RES-TPL*) et vous ne savez pas ce qu'il veut dire ?
Cliquez sur le menu **Lexique** tout en bas à gauche. C'est un dictionnaire intégré qui vous explique tous les mots techniques, les types de mouvements et les acronymes utilisés dans l'application.

---

### 🎉 Vous êtes prêt(e) !
Le logiciel est conçu pour être impossible à "casser". N'ayez pas peur de cliquer et de naviguer. Le principe d'or est simple :
**Les ventes diminuent le stock. Les réapprovisionnements augmentent le stock. Le logiciel calcule le reste.**

Bonnes ventes !
