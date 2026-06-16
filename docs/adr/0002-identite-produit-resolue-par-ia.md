# 2. Identité produit résolue par l'IA, sans référentiel canonique

Date : 2026-06-16
Statut : Accepté

## Contexte

Le réassort par inférence (voir [ADR 0001](0001-reassort-par-inference-de-scans.md))
suppose de reconnaître qu'un produit du scan B est **le même** que celui du scan A.
Or c'est le modèle de vision qui nomme les produits, et il varie d'un scan à
l'autre (« lait demi-écrémé », « brique de lait », « Lait ½ »). Sans résolution
d'identité, l'inférence prend des variantes de nom pour des produits différents et
génère du bruit (faux positifs d'absence).

Le PRD évoque un « référentiel produits » (§6, §11) et une entité `Produit` (§8),
mais le code n'en a aucun : les produits sont du texte libre dédupliqué par `ilike`.

Trois pistes : (A) référentiel canonique avec étape de matching ; (B) normalisation
légère des noms ; (C) réconciliation par l'IA au moment du scan, en lui fournissant
les produits déjà suivis dans l'emplacement.

## Décision

Retenir **(C)** pour le MVP : à chaque scan, le modèle reçoit la liste des produits
déjà suivis dans l'emplacement concerné et indique, pour chaque détection, s'il
s'agit d'un produit connu ou d'un nouveau. L'inférence raisonne sur cette identité
réconciliée, pas sur le nom brut.

Le concept de **Produit canonique** est conservé au glossaire pour permettre une
évolution ultérieure vers un vrai référentiel (A).

## Conséquences

- Pas de table `products` en MVP ; l'identité est portée par le suivi de stock par
  emplacement et l'étape de réconciliation IA.
- L'appel de scan doit recevoir en contexte les produits suivis de l'emplacement,
  et son schéma de sortie doit pouvoir pointer un produit existant.
- Robustesse dépendante du LLM (non déterministe) ; acceptable car la validation
  humaine reste obligatoire avant tout réassort.
- Le PRD §8 (entité `Produit`) et §6/§11 (« référentiel ») doivent être reformulés :
  il n'y a pas de référentiel statique en v1.

## Alternatives écartées

- **(A) Référentiel canonique** : plus robuste à terme mais coûteux à construire et
  maintenir pour un MVP ; reporté en v2.
- **(B) Normalisation de noms** : trop fragile face aux variantes inventées par la
  vision ; insuffisant pour porter seule l'inférence.
