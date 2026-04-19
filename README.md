# Corner 1 Hobikardisari

See on Corner 1 hobikardisarja haldussüsteem, mis on ehitatud NextJS ja Firebase Studio abil.

## Süsteemi arhitektuur ja ohumärgid

Süsteemi arendamisel on oluline silmas pidada järgmisi kriitilisi aspekte:

### 1. Andmete säilitamine (LocalStorage)
Rakendus kasutab praegu andmete salvestamiseks ainult brauseri `localStorage`-it. 
- **Risk:** Andmed on seadmes kinni. Kui puhastate brauseri vahemälu või vahetate arvutit, on andmed kadunud.
- **Lahendus:** Tulevikus tuleks andmed kolida Firebase Firestore'i pilveandmebaasi.

### 2. Koodi struktuur ja failide maht
Kuna `races/page.tsx` on mahukas komponent, võib sealne kood kergesti muutuda hapraks.
- **Risk:** Puuduvad sulud või vigane süntaks keeruliste muudatuste tegemisel.
- **Lahendus:** Kasutage alati `utils.ts` ja `constants.ts` faile, et hoida UI loogika ja andmete töötlemise loogika lahus.

### 3. Andmete terviklikkus
Süsteem eeldab, et ajad ja kardinumbrid sisestatakse korrektses vormingus.
- **Risk:** Vigane ajavorming võib rikkuda edetabelite arvutamise.
- **Lahendus:** `utils.ts` failis olevad `parseLapTimeToMillis` ja `cleanName` funktsioonid on kriitilised andmete puhastamiseks.

### 4. Jõudlus
Kogu race-generation loogika toimub kliendi poolel.
- **Risk:** Väga suure hulga osalejate puhul võib rakendus muutuda uimaseks.
- **Lahendus:** Hoida osalejate arv mõistlikes piirides (sessiooni mahu järgi).

## Kuidas alustada?
- Mine `/races` lehele, vali etapp ja lisa osalejad.
- Järgi samme 1-8, et täita tulemused ja saada punktitabel.
