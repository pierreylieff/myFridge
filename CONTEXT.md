# Contexte du domaine — myFridge

Glossaire du langage métier de myFridge. Ce fichier décrit **ce que les mots
veulent dire**, pas comment ils sont implémentés. Si un terme du code ou du PRD
contredit une définition ci-dessous, c'est la définition qui fait foi (ou il faut
la corriger explicitement).

---

## Emplacement

Un lieu physique de rangement scannable, distinct : **Frigo**, **Armoire/Placard**
ou **Congélateur**. Le *ticket de caisse* n'est pas un emplacement (voir *Scan*).

Un *Stock réel* est l'union des produits présents dans tous les emplacements d'un
utilisateur. L'inférence de consommation se raisonne **par emplacement** : on ne
compare que des scans d'un même emplacement entre eux (un Frigo se compare à un
Frigo, jamais à une Armoire).

L'**Emplacement** d'un produit en stock vient de **là où il a été scanné**
(le type de scan), pas de son *Rayon*. Un même produit peut exister à deux
emplacements (une bière au Frigo *et* au Placard) : ce sont **deux lignes de stock
distinctes**, chacune comparée à son propre historique de scans.

## Rayon

La catégorie de **classement en magasin** d'un produit : Frais, Épicerie,
Surgelés, Boissons, Hygiène, Autre. Sert à **trier la liste de courses** par rayon.

À ne pas confondre avec l'*Emplacement* : ce sont deux axes orthogonaux. Une bière
est `rayon = Boissons` mais `emplacement = Frigo`. Le rayon dit *où l'acheter*,
l'emplacement dit *où c'est rangé à la maison* (et sert à l'inférence). Aucune
équivalence automatique rayon → emplacement n'est valide.

## Garde-manger

Le conteneur logique qui regroupe le *Stock réel* d'un utilisateur. Un utilisateur
a un garde-manger ; celui-ci agrège les produits de tous ses *Emplacements*.

**« Garde-manger » est le terme utilisateur canonique** (UI, PRD, base). « Stock
réel » est un terme interne désignant le contenu présent du garde-manger ;
« Inventaire » est abandonné comme synonyme (l'écran `Inventory.tsx` doit
s'afficher « Garde-manger »).

## Scan

La capture d'une photo d'**un seul Emplacement à la fois** (ou d'un ticket de
caisse), analysée par l'IA pour produire une liste de *produits détectés* avec un
*niveau de confiance*. Un scan ne mélange jamais deux emplacements.

Un scan est une **opération en ligne** (l'analyse passe par l'IA) : il n'existe pas
de scan hors-ligne mis en file. Hors-ligne, l'utilisateur consulte et édite sa
*liste de courses* et son *Stock réel*, mais ne scanne pas. Les **images ne sont
jamais conservées** : seules les données extraites le sont (engagement RGPD ;
remplace toute mention d'une rétention « 24 h »).

## Réassort par inférence (« à racheter »)

myFridge **déduit** ce qui doit être racheté en comparant des scans dans le temps,
plutôt que de demander à l'utilisateur de déclarer un niveau cible.

Règle de base : un produit **précédemment détecté dans un Emplacement** qui
disparaît de **2 scans consécutifs du même Emplacement** est *proposé* (non coché
d'office) au réassort.

L'inférence porte sur la **présence** (vu / pas-vu), jamais sur un décompte de
quantité estimé par l'IA. Un produit passe au réassort dans deux cas, et deux
seulement : (1) il est **inféré absent** (règle des 2 scans), ou (2) il est
**marqué « manquant »** manuellement par l'utilisateur. La *quantité* d'un produit
reste une donnée déclarative (saisie/édition manuelle, dédup, affichage) ; elle
n'est jamais décomptée automatiquement par un scan et ne déclenche pas le réassort
en « atteignant 0 ».

**Suivi d'absence** — le mécanisme qui rend la règle déterministe, piloté par le
seuil de confiance unique (70 %) :

- *Démarrage* : un produit n'est « suivi » dans un emplacement que s'il y a été
  détecté au moins une fois avec **confiance ≥ seuil** (une détection faible ne
  crée pas de produit fantôme).
- *Incrément* : à chaque scan suivant du même emplacement où le produit suivi
  n'est **pas** détecté → +1 absence. À **2**, il est proposé au réassort.
- *Réinitialisation* : s'il est de nouveau détecté **≥ seuil** → compteur à 0.
- *Détection faible* (< seuil) : état **neutre** — n'incrémente ni ne réinitialise.

> Décision : c'est le modèle retenu pour myFridge, **et non** un modèle de
> « niveau cible / par-stock » (où l'utilisateur déclarerait `target_qty` et où le
> déficit `cible − réel` alimenterait la liste). Le code actuel implémente par
> erreur le modèle « niveau cible » ; il devra être réaligné. Voir l'ADR à venir.

## Produit / Article

Un **Produit** est l'**identité réutilisable** d'une denrée (« le lait demi-écrémé »).
Un **Article** est une **ligne** qui référence un produit dans un contexte donné :
une ligne de *Stock réel* (à un emplacement) ou une ligne de *liste de courses*.

myFridge n'a **pas de référentiel produits canonique** (pas de table de référence).
L'identité d'un produit entre deux scans est **résolue par l'IA au moment du scan** :
on fournit au modèle les produits déjà suivis dans l'emplacement et il indique si
une détection correspond à un produit connu ou en crée un nouveau. C'est ce
rapprochement — et non un nom en texte libre comparé caractère par caractère — qui
permet à l'inférence d'absence de raisonner sur « le même produit » d'un scan à
l'autre. (Un vrai référentiel canonique reste une évolution possible en v2.)

**Deux régimes d'identité, selon le besoin :**

- *Identité dans le temps* (le même produit sur plusieurs scans d'un emplacement) :
  **réconciliation par l'IA**, car c'est là que les variantes de nom de la vision
  faussent l'inférence.
- *Anti-doublon dans une même liste / un même stock* (ne pas ajouter deux fois le
  même article) : **match de nom normalisé** (minuscules, accents repliés,
  singulier), bon marché et déterministe, complété d'une **fusion proposée** pour
  les quasi-doublons que le match rate. Pas d'appel IA sur un simple ajout manuel.

## Péremption

La date au-delà de laquelle un produit est considéré comme périmé. En MVP, c'est
une donnée **purement informative** (alerte douce « bientôt périmé » dans le
garde-manger) : elle **ne déclenche pas** de réassort automatique. Le réassort
fondé sur la durée de conservation est reporté en v2 (il suppose une base de
durées de conservation par produit et un scan de ticket fiabilisé).

## Produit détecté / Niveau de confiance

Le résultat unitaire d'un *Scan* : un nom de produit, un rayon, une quantité, une
unité et une **confiance** (0 à 1). Sous le seuil (70 %), une détection est
montrée mais **non cochée** par défaut, et ne sert pas de base fiable à
l'inférence d'absence.
