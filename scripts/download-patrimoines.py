#!/usr/bin/env python3
"""Télécharge les 60 images patrimoine depuis le site de référence."""
import os
import urllib.request
import sys

BASE_URL = "https://medt121.github.io/zalavrai/patrimoine"
OUTPUT_DIR = "app/modules/cards/assets/patrimoine"

PATRIMOINS = {
    "Animaux de la RDC": [
        "rdc-okapi", "rdc-bonobo", "rdc-gorille", "rdc-paon-congo",
        "rdc-elephant", "rdc-hippopotame", "rdc-crocodile", "rdc-leopard",
        "rdc-lion", "rdc-perroquet-gris", "rdc-chimpanze", "rdc-bongo"
    ],
    "Pierres & minerais": [
        "min-diamant", "min-or", "min-cuivre", "min-cobalt", "min-coltan",
        "min-cassiterite", "min-malachite", "min-tourmaline", "min-amethyste",
        "min-wolframite", "min-heterogenite", "min-quartz"
    ],
    "Animaux aquatiques": [
        "aqua-orque", "aqua-narval", "aqua-beluga", "aqua-morse", "aqua-loutre",
        "aqua-saumon", "aqua-pieuvre", "aqua-crabe-royal", "aqua-homard",
        "aqua-baleine-grise", "aqua-otarie", "aqua-phoque"
    ],
    "Animaux terrestres": [
        "terre-kangourou", "terre-koala", "terre-panda", "terre-ours-polaire",
        "terre-jaguar", "terre-puma", "terre-bison", "terre-grizzly", "terre-lama",
        "terre-alpaga", "terre-paresseux", "terre-capybara"
    ],
    "Oiseaux": [
        "ois-toucan", "ois-ara-rouge", "ois-kiwi", "ois-cacatoes", "ois-manchot",
        "ois-aigle", "ois-colibri", "ois-harfang", "ois-macareux", "ois-condor",
        "ois-oiseau-paradis", "ois-cardinal"
    ]
}


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    all_items = []
    for group, items in PATRIMOINS.items():
        all_items.extend(items)

    print(f"Téléchargement de {len(all_items)} patrimoines vers {OUTPUT_DIR}...")
    failed = []
    for name in all_items:
        url = f"{BASE_URL}/{name}.png"
        dest = os.path.join(OUTPUT_DIR, f"{name}.png")
        try:
            urllib.request.urlretrieve(url, dest)
            print(f"  OK {name}.png")
        except Exception as e:
            print(f"  FAIL {name}.png : {e}")
            failed.append(name)

    if failed:
        print(f"\n{len(failed)} échecs : {', '.join(failed)}")
        sys.exit(1)
    print("\nTous les patrimoines ont été téléchargés.")


if __name__ == "__main__":
    main()
