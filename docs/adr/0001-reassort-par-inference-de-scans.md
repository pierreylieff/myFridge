# 1. Réassort par inférence de scans (présence, par emplacement)

Date : 2026-06-16
Statut : Accepté

## Contexte

myFridge doit décider **quels produits proposer à la liste de courses**. Deux
modèles s'opposaient :

- **Niveau cible (par-stock)** : l'utilisateur déclare une quantité souhaitée
  (`target_qty`) par produit ; le déficit `cible − réel` alimente la liste. C'est
  ce que le code a implémenté (migration `inventory_targets`, `restockDeficit`).
- **Consommation inférée** : l'app *déduit* ce qui a été consommé en comparant des
  scans dans le temps. C'est ce que décrit le PRD (« absent de 2 scans
  consécutifs »), mais que le code n'implémente pas.

Le modèle « niveau cible » est plus simple et déterministe, mais déplace la charge
sur l'utilisateur (déclarer une cible pour chaque produit) et trahit la promesse
produit (« l'IA estime ce qui a été consommé »). Le modèle inféré porte la valeur
différenciante du produit, au prix d'un risque de faux positifs lié à la fiabilité
de la vision.

La règle d'inférence du PRD était par ailleurs sous-spécifiée : « absent de quoi »
(le garde-manger est l'union de plusieurs emplacements), et coexistait avec une
seconde règle incompatible (« quand sa quantité atteint 0 »).

## Décision

Adopter le **réassort par inférence de scans**, précisé ainsi :

1. **Inférence par emplacement.** On ne compare que des scans d'un *même*
   emplacement (Frigo vs Frigo). L'emplacement devient un attribut du stock,
   distinct du rayon, alimenté par le type de scan.
2. **Inférence sur la présence, pas la quantité.** Un scan constate vu / pas-vu ;
   il ne décompte pas de quantités estimées. La règle « quantité atteint 0 » est
   abandonnée comme déclencheur automatique.
3. **Suivi d'absence piloté par le seuil de confiance (70 %)** : démarrage à la
   première détection ≥ seuil ; +1 par scan sans détection ; réassort à 2 ;
   reset si revu ≥ seuil ; neutre si revu < seuil.
4. **Deux déclencheurs de réassort, et deux seulement** : absence inférée, ou
   marquage manuel « manquant » par l'utilisateur.

## Conséquences

- Le code actuel (`target_qty`, `needs_restock`, `restockDeficit`,
  `syncListFromInventory`, `RAYON_LOCATION`) **devra être réaligné** : il
  implémente le modèle abandonné.
- Le schéma `pantry_items` doit gagner un **emplacement** et l'état de **suivi
  d'absence** (compteur / dernier scan vu) par produit et par emplacement ; les
  `scans` doivent conserver assez d'historique pour comparer deux captures.
- Le PRD §6 (règles métier), §8 (modèle de données) et le Flux 1 doivent être
  réécrits pour refléter le parcours scan → stock → inférence → liste.
- Risque assumé : faux positifs dus aux angles morts de la vision. Atténué par le
  garde-fou de confiance et par la validation humaine obligatoire (PRD §9).

## Alternatives écartées

- **Niveau cible / par-stock** : rejeté car déplace l'effort sur l'utilisateur et
  trahit la proposition de valeur IA. (Pourrait revenir en option avancée.)
- **Inférence sur quantité décomptée** : rejeté car l'estimation quantitative par
  photo est trop peu fiable (faux positifs/négatifs, réconciliation complexe).
- **Inférence sur le garde-manger global** (tous emplacements) : rejeté car
  conflait « rangé ailleurs » et « consommé ».
