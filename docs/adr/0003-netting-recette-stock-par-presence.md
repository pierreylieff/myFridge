# 3. Netting recette/planning ↔ stock par présence, en doux

Date : 2026-06-16
Statut : Accepté

## Contexte

Quand une recette (US8/US9) ou le planning de la semaine (US10) alimente la liste
de courses, faut-il retrancher ce que l'utilisateur a déjà au *Garde-manger* ?

Le netting **quantitatif** (`besoin recette − quantité_stock`) supposerait des
quantités de stock fiables. Or [ADR 0001](0001-reassort-par-inference-de-scans.md)
a délibérément rendu la quantité **déclarative et non décomptée** (l'inférence
porte sur la présence, pas la quantité). Un netting quantitatif sur des quantités
périmées d'information retirerait à tort un produit de la liste → **rupture en
plein repas**, le faux négatif le plus coûteux du produit.

## Décision

**Netting par présence, en doux.** Pour chaque ingrédient :

- s'il correspond à un produit **présent au Stock réel** (quelle que soit la
  quantité), il est ajouté à la liste mais **pré-décoché** et signalé dans une
  section « Tu en as peut-être déjà » ;
- sinon, il est ajouté **coché** normalement.

Aucun ingrédient n'est **jamais supprimé en silence** : l'utilisateur garde la
main (validation humaine, PRD §9).

## Conséquences

- La génération de liste depuis une recette/planning doit lire le stock pour
  marquer les ingrédients présents (pré-décochés), pas pour soustraire des
  quantités.
- Le netting **quantitatif** est reporté en v2, conditionné à des quantités de
  stock fiables (donc à une éventuelle révision du modèle d'inférence).
- Le PRD §6 (« ingrédients rapprochés du référentiel produits ») est reformulé :
  les ingrédients deviennent des articles de liste, rayon attribué par l'IA
  d'import, dédup par match normalisé, présence signalée par netting doux.

## Alternatives écartées

- **Pas de netting** : plus simple, mais perd la valeur « ne pas racheter ce que
  j'ai déjà ».
- **Netting quantitatif** : incohérent avec le modèle de quantités non fiables ;
  risque de rupture silencieuse.
