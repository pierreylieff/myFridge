## 446ba16 — 2026-06-16

**Nouvelle vue Stock avec cibles de réassort et pont vers la liste de courses**

- Écran **Inventaire** (`/stock`) : affichage du stock par rayon, stepper quantité, badges « stock complet » / « manque N » et bouton flottant « Compléter les courses »
- Nouveau modèle `PantryItem` : champs `target_qty` (quantité souhaitée) et `needs_restock` (marquage manuel « à racheter »)
- Logique `restockDeficit` : calcule le manque entre cible et réel, ou renvoie 1 si `needs_restock` sans cible définie
- API garde-manger : `fetchPantryItems`, `addOrMergePantryItem` (déduplication nom + unité), `updatePantryItem`, `deletePantryItem`, `setRestock`, `syncListFromInventory`
- `AddEditItem` étendu en mode `stock` : champ « quantité souhaitée (cible) », libellés et navigation adaptés (`/stock/item/:id`)
- `BottomNav` remaniée : onglets **Stock** et **Courses** (Planning retiré)
- Boucle retour sur `Home` : cocher un article acheté propose un toast « Ajouter au stock » via `receiveIntoStock`
- Résultats de scan redirigés vers le garde-manger (`addOrMergePantryItem`) au lieu de la liste de courses
- Serveur MCP : 4 nouveaux outils (`add_to_stock`, `set_pantry_target`, `mark_restock`, `sync_shopping_list`) et affichage du déficit dans `fridgeToText`
- Migration Supabase : colonnes `target_qty` / `needs_restock` sur `pantry_items`, index de déduplication, garde-manger créé automatiquement à l'inscription
- Constante `RAYON_LOCATION` : associe chaque rayon à son emplacement physique (Frigo, Placard, Congélateur)
- 3 ADR ajoutés : réassort par inférence de scans, identité produit résolue par l'IA, netting recette/stock par présence

