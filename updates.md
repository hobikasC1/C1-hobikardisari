SÜSTEEMI VAJALIKUD MUUDATUSED PÄRAST RAPLA ETAPPI

1. "Lühikokkuvõte süsteemist: osalejate sisestamine, kvalist eelfinaalidesse ja eelfinaalidest finaalidesse töötas väga hästi. Samuti pildilt importis kõik nimed numbrid õigetesse lahtritesse ja täitis need vastavalt nagu pidi. Üldpildis vägaaaa mõnuuuus oli nokitseda sellega. Aga alati see paar nipet näpet asja mis vaja korda ajada. :D 

Kvalifikatsioonid: Q1 ja Q2 vahel tekkis viga.

Genereerisime kõik Q1 ja Q2 grupid - q1 andis ilusti kõigile erinevad kardid - pärast seda kui q1 lõpus öeldi, et kart nr 5 on katki ja sõidetakse selle asemel kart nr 6ga - läksime kardihaldusesse ja võtsime kardinumbritest 5 välja, panime “salvesta” - pärast seda Q2 andis igas grupis mitmele sõitjale täpselt sama kardinumbri. 

Sellega tekkis meil seisak ja pidime hakkama paberile asendama osalejate topelt saadud kardinumbreid. Kuna grupid olid osalejatele juba loodud ja 1 kvali voor oli sõidetud ja q1 tulemused olid juba sisestatud, siis me ei saanud riskida sellega, et vajutame genereerime uuesti kvali grupid. 

Oskad sa öelda - kas see uuesti genereerimine oleks jätnud q1 grupis kardinumbrid samaks ja sisestatud tulemused oleks samuti alles jäänud? Või oleks ta kõik uuesti genereerinud ja q1 tulemused kustutanud?

Meie sisestasime päeva alguses 10 kardinumbrit etapi kardilahtrisse - kas peame lisama ainult 9 kardinumbrit, kui grupis max kardi arv on 9? või võin lisada vabalt ala 12 kardinumbrit aga süsteem võtab ikka nendest kasutusele suvaliselt 9 numbrit? Kuidas peaksime seal lahtris toimima, et saada parim väljund?"

Lahendatud (09.05.2026):
- Lisatud nupp "Uuenda ainult Q2 kardid" — Q1 grupid ja tulemused jäävad alles, muudetakse ainult Q2 kardinumbreid.
- "Genereeri uuesti" on nüüd selgelt destruktiivne: enne kinnitamist hoiatab, et Q1/Q2 tulemused kustutatakse.
- Kardinumbrite sisestus deduplitseeritakse ning süsteem kontrollib, et unikaalseid kardi numbreid on vähemalt grupi maksimaalse suuruse jagu; vastasel juhul genereerimine blokitakse.
- Soovituslik praktika: kardilahtrisse sisestada ainult tegelikult töös olevad unikaalsed numbrid.







2. "Finaalid


A finaalis juhtus selline asi, et kohtunikud määrasid sõitjale A FINAALIS - DISKLAFFI ja etapilt saadud kogupunktidest peame talt maha arvestama - 10punkti.


Igaks juhuks mainin, et tänaseks on DSQ sõitjale tühistatud ja saab lihtsalt -10punkti karistuseks. Seega ära Rapla etapis seda muutma hakka. 🙌


Aga sellegipoolest juhtis see meid selleni, et vajame mingisugust DSQ loogikat systeemi.

Eelfinaal gruppides ja Finaali gruppides saan DSQ anda vabalt ka märkus/karistus lahtrisse kirjalikult ja siis tõstan ta lihtsalt oma grupis viimaseks ja saab lihtsalt vastavalt viimasele kohale punkte ikkagi.

Aga kui kohtunikud määravad näiteks ÜLD DSQ ehk tervest sessioonist (eelfinaal,finaal) tahavad teda ilma tulemuseta jätta, siis kuidas me seda saaks teha? See tähendaks seda, et pean saama märkida ära kes saab ÜLD DSQ, siis pärast salvestamist süsteem enam teda enda klassis(junior,standard,heavy) punkti saajaks ei arvesta ja tema punktid saab temast järgmine sõitja. 

Punktide mahaarvestus: Igal etapil peaks meil olema võimalik võtta ükskõik milliselt sõitjalt punkte maha. Kui kohtunik nägi rikkumist aga see otsustatakse näiteks paar tundi pärast etappi, siis peaksime saama talle anda karistuse “punkte maha võttes”. 
Selle võiks teha isegi  manuaalseks editiks üldisel punktiarvestuse lehel, siis saame ise neid punkte maha arveldada kellel vaja. 🙌"

Lahendatud (09.05.2026):
- ÜLD DSQ / “Punktideta” eemaldab sõitja punktijagamisest, nii et järgmine sõitja saab tema punktid (kehtib nii eelsõitudele kui finaalidele).
- Lisatud etapi‑põhine punktide korrigeerimine (Punktid +/-) koos põhjuse väljaga, et hilisemaid karistusi käsitsi rakendada.
- Seotud muudatused uuendavad automaatselt punktitabelit (standings).












3. "ÜLDISEM MUUDATUS PUNKTIARVESTUSE LEHEL

Meie võistluse reeglites on selline asi kirjas: Hooaja lõpus - pärast viimase etapi tulemuste uuendamist - arvutatakse kõikidelt sõitjatelt nende halvim etapi punktisaadus maha. 
Näiteks kui ma olen saanud 3ndal etapilt kokku 12 punkti ainult ja kõik teised etapid sellest rohkem, siis see 12 võetakse kogusummast maha. Samuti võib olla halvim tulemus 0 ja see võib ka olla etapp kus isegi sõitjat polnud kohal ehk teisisõnu jälle 0.
Seda lahendust kasutatakse ka päris Võistluskartide sarjades, toob rohkem võrdsust katkestamiste ja muude jamade läbi.
	

Hetkel rohkemat ei meenugi.


MUUD KÜSIMUSED:

Kas saan kuidagi mustand etappi testida süsteemis? Tahan lihtsalt neid eelnevaid kvalifikatsiooni küsimusi testida."