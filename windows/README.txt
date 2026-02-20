═══════════════════════════════════════════════════════════════
   DASHBOARD RSE FOURNISSEURS — Guide d'utilisation Windows
═══════════════════════════════════════════════════════════════

PREMIÈRE INSTALLATION (une seule fois)
───────────────────────────────────────
1. Copiez le fichier "client_secret_rse_dashboard.json" dans :
   C:\Users\[VotreNom]\Documents\

   (Demandez ce fichier à Blaise si vous ne l'avez pas)

2. Clic droit sur "install.ps1"
   → Sélectionnez "Exécuter avec PowerShell"
   → Si demande de confirmation : tapez "O" puis Entrée

   Le script va automatiquement :
   ✅ Installer Python si nécessaire
   ✅ Installer Git si nécessaire
   ✅ Télécharger le code du dashboard
   ✅ Configurer l'environnement Python

3. À la fin de l'installation, vous verrez :
   "Installation terminée avec succès !"


MISE À JOUR DES DONNÉES (à faire avant chaque présentation)
─────────────────────────────────────────────────────────────
1. Double-cliquez sur "update.bat"

2. Si c'est la première fois, une fenêtre Google s'ouvre :
   → Connectez-vous avec votre compte Google professionnel
   → Cliquez "Autoriser"
   → La fenêtre se ferme automatiquement (c'est normal)

3. Le script affiche les résultats :
   🟢 X bons élèves (≥67%)
   🟡 X en progression (34-66%)
   🔴 X prioritaires (≤33%)

4. Le dashboard s'ouvre automatiquement dans votre navigateur
   URL : https://77darius77.github.io/rse-dashboard/

   Note : les données apparaissent en ~2 minutes après la mise à jour


PROBLÈMES COURANTS
──────────────────
❌ "La connexion a échoué" sur localhost:8080
   → C'est NORMAL après l'authentification Google.
     Fermez cet onglet et attendez que le script finisse.

❌ "client_secret non trouvé"
   → Vérifiez que le fichier est bien dans Documents\
     et qu'il s'appelle exactement : client_secret_rse_dashboard.json

❌ Erreur 403 ou token expiré
   → Supprimez le fichier : rse-dashboard\scripts\token.json
   → Relancez update.bat (une nouvelle authentification sera demandée)

❌ "winget n'est pas reconnu"
   → Votre Windows est peut-être trop ancien.
     Installez Python manuellement : https://www.python.org/downloads/
     Installez Git manuellement : https://git-scm.com/download/win
     Puis relancez install.ps1


FICHIERS IMPORTANTS
────────────────────
update.bat          → Lanceur principal (double-clic)
update.ps1          → Script PowerShell de mise à jour
install.ps1         → Installation initiale (une seule fois)
README.txt          → Ce fichier

Dossier du projet installé : C:\Users\[VotreNom]\Documents\rse-dashboard\


SUPPORT
────────
Dashboard live : https://77darius77.github.io/rse-dashboard/
Repository     : https://github.com/77Darius77/rse-dashboard
