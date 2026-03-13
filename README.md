# TAFIMES MES – Manufacturing Execution System

Application web de gestion de production pour usine agroalimentaire.

## Stack technique

- **Frontend** : Next.js 14, React, TypeScript, Tailwind CSS
- **Backend/DB** : Supabase (PostgreSQL + Auth + RLS)
- **Déploiement** : Vercel (frontend) + Supabase (backend)

## Modules

| Module | Route | Description |
|--------|-------|-------------|
| Dashboard | `/dashboard` | KPIs et ordres récents |
| Ordres | `/orders` | Liste et création des ordres |
| Allocation | `/allocations` | Allocation des matières premières |
| Production | `/production` | Saisie atelier (optimisée tablette) |
| Rapports | `/reports` | Rendements, pertes, traçabilité |
| Admin | `/admin` | Référentiel, utilisateurs, lots |

## Installation

### 1. Prérequis

- Node.js 18+
- Compte Supabase (https://supabase.com)

### 2. Créer le projet Supabase

1. Créez un nouveau projet sur Supabase
2. Dans l'éditeur SQL, exécutez `supabase/migrations/001_initial_schema.sql`
3. Exécutez `supabase/seed.sql` pour les données initiales

### 3. Configuration

```bash
cp .env.example .env.local
```

Remplissez `.env.local` avec vos clés Supabase :
- `NEXT_PUBLIC_SUPABASE_URL` → Settings > API > Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Settings > API > anon key
- `SUPABASE_SERVICE_ROLE_KEY` → Settings > API > service_role key

### 4. Installation locale

```bash
npm install
npm run dev
```

L'application sera disponible sur http://localhost:3000

### 5. Créer le premier utilisateur admin

1. Allez sur votre projet Supabase > Authentication > Users
2. Créez un utilisateur avec email/password
3. Dans Table Editor > profiles, mettez à jour son `role_id` pour le rôle `admin`

## Déploiement Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel

# Configurer les variables d'environnement dans Vercel Dashboard:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
```

## Rôles utilisateurs

| Rôle | Accès |
|------|-------|
| `admin` | Tout (référentiel, utilisateurs, production) |
| `production_manager` | Ordres, validation, clôture, rapports |
| `stock_manager` | Allocation des matières, lots |
| `operator` | Saisie production, consultation ordres |

## Workflow de production

```
Créer ordre (draft)
    ↓ Valider
Ordre validé
    ↓ Allouer matières
Matières allouées
    ↓ Saisir production
En production
    ↓ Terminer
Terminé
    ↓ Clôturer
Clôturé → Stocks mis à jour + Traçabilité disponible
```

## Structure du projet

```
├── app/
│   ├── (dashboard)/        # Pages protégées
│   │   ├── dashboard/      # KPIs
│   │   ├── orders/         # Gestion ordres
│   │   ├── allocations/    # Allocation matières
│   │   ├── production/     # Saisie production
│   │   ├── reports/        # Rapports + traçabilité
│   │   └── admin/          # Administration
│   ├── api/                # Routes API
│   └── login/              # Authentification
├── components/             # Composants React
├── lib/                    # Utilitaires et client Supabase
├── supabase/               # Migrations SQL + seed
└── types/                  # Types TypeScript
```
