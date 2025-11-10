# MemoMind - Markdown Notebook Application

A full-stack markdown notebook application built with Next.js, React, TypeScript, and PostgreSQL. Features user authentication and a powerful markdown editor.

## Features

- 📝 **Markdown Editor**: Write and preview markdown notes with a feature-rich editor
- 👤 **User Authentication**: Secure registration and login system
- 💾 **PostgreSQL Database**: Persistent storage for users and notes
- 🎨 **Modern UI**: Clean and responsive design with Tailwind CSS
- ⚡ **Real-time Preview**: Toggle between edit and preview modes
- 🔒 **Secure**: Password hashing with bcrypt

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL
- **Markdown Editor**: SimpleMDE (EasyMDE)
- **Authentication**: bcrypt for password hashing
- **Database Client**: node-postgres (pg)

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd memomind
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL database**

   Create a new PostgreSQL database:
   ```bash
   createdb memomind
   ```

   Or using psql:
   ```sql
   CREATE DATABASE memomind;
   ```

4. **Initialize the database schema**

   Run the SQL script to create tables:
   ```bash
   psql -d memomind -f scripts/init-db.sql
   ```

   Or manually execute the SQL:
   ```bash
   psql -d memomind
   ```
   Then copy and paste the contents of `scripts/init-db.sql`

5. **Configure environment variables**

   Create a `.env.local` file in the root directory:
   ```bash
   cp .env.example .env.local
   ```

   Update the values in `.env.local` with your PostgreSQL credentials:
   ```env
   DB_USER=your_postgres_user
   DB_HOST=localhost
   DB_NAME=memomind
   DB_PASSWORD=your_postgres_password
   DB_PORT=5432
   ```

## Running the Application

1. **Start the development server**
   ```bash
   npm run dev
   ```

2. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### First Time Setup

1. **Register a new account**
   - Click "Register" on the home page
   - Enter your name, email, and password
   - You'll be automatically logged in after registration

2. **Create your first note**
   - Click "+ New Note" in the sidebar
   - Enter a title for your note
   - Write your content using markdown syntax
   - Click "Save" to store your note

3. **Manage your notes**
   - Click on any note in the sidebar to view/edit it
   - Use the "Preview" button to see the rendered markdown
   - Delete notes using the "Delete" button

### Markdown Features

The editor supports standard markdown syntax:
- **Bold**: `**text**` or `__text__`
- *Italic*: `*text*` or `_text_`
- Headers: `# H1`, `## H2`, `### H3`, etc.
- Lists: `- item` or `1. item`
- Links: `[text](url)`
- Images: `![alt](url)`
- Code blocks: ` ```language ` 
- Quotes: `> quote`

## Database Schema

### Users Table
```sql
- id: SERIAL PRIMARY KEY
- email: VARCHAR(255) UNIQUE NOT NULL
- password: VARCHAR(255) NOT NULL
- name: VARCHAR(255) NOT NULL
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Notes Table
```sql
- id: SERIAL PRIMARY KEY
- user_id: INTEGER (Foreign Key to users)
- title: VARCHAR(255) NOT NULL
- content: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## API Routes

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### Notes
- `GET /api/notes` - Get all notes for authenticated user
- `POST /api/notes` - Create a new note
- `PUT /api/notes` - Update an existing note
- `DELETE /api/notes?id={noteId}` - Delete a note

## Project Structure

```
memomind/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   └── register/route.ts
│   │   └── notes/route.ts
│   ├── components/
│   │   └── MarkdownEditor.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── notebook/page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   └── db.ts
├── scripts/
│   └── init-db.sql
├── .env.example
└── README.md
```

## Development

### Building for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Security Notes

- Passwords are hashed using bcrypt before storage
- User sessions are managed client-side with localStorage
- API routes validate user authentication via headers
- SQL injection protection through parameterized queries

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running: `pg_isready`
- Check your `.env.local` credentials
- Verify the database exists: `psql -l`

### Port Already in Use
- Change the port in `package.json` or kill the process using port 3000

### Module Not Found Errors
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

## Future Enhancements

- [ ] Session-based authentication with JWT
- [ ] Note sharing and collaboration
- [ ] Tags and categories for notes
- [ ] Search functionality
- [ ] Export notes to PDF/HTML
- [ ] Dark mode support
- [ ] Rich text formatting toolbar

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
