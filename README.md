# MemoMind - Markdown Notebook Application

A full-stack markdown notebook application built with Next.js, React, TypeScript, and PostgreSQL. Features user authentication and a powerful markdown editor.

## Features

- 📝 **Markdown Editor**: Write and preview markdown notes with a feature-rich editor
- 👤 **User Authentication**: Secure registration and login system
- 💾 **PostgreSQL Database**: Persistent storage for users and notes
- 📁 **File Management**: Upload, organize, and manage files with S3 storage
- 🗂️ **Directory Support**: Create folders to organize your files
- 🔍 **Search & Filter**: Search files by name and filter by type
- 🎨 **Modern UI**: Clean and responsive design with Tailwind CSS
- ⚡ **Real-time Preview**: Toggle between edit and preview modes
- 🔒 **Secure**: Password hashing with bcrypt and secure S3 file storage

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL
- **File Storage**: AWS S3
- **Markdown Editor**: SimpleMDE (EasyMDE)
- **Authentication**: bcrypt for password hashing
- **Database Client**: node-postgres (pg)
- **Icons**: Heroicons

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- AWS Account with S3 bucket configured
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

   Run the initialization script:
   ```bash
   node scripts/init-db.js
   ```

   This will create all necessary tables including:
   - users
   - notes
   - files
   - directories

5. **Configure environment variables**

   Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```

   Update the values in `.env` with your credentials:
   ```env
   # Database Configuration
   DATABASE_URL=postgresql://username:password@host:port/database
   DB_USER=your_postgres_user
   DB_HOST=localhost
   DB_NAME=memomind
   DB_PASSWORD=your_postgres_password
   DB_PORT=5432

   # AWS S3 Configuration
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_aws_access_key_id
   AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
   AWS_S3_BUCKET_NAME=your_s3_bucket_name
   ```

6. **Set up AWS S3**

   a. Create an S3 bucket in your AWS account
   
   b. Configure bucket permissions:
   - Enable versioning (optional but recommended)
   - Set appropriate CORS configuration if accessing from browser
   
   c. Create an IAM user with S3 access:
   - Attach policy: `AmazonS3FullAccess` or create a custom policy
   - Generate access keys (Access Key ID and Secret Access Key)
   
   d. Update your `.env` file with the S3 credentials

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

4. **Use the File Manager**
   - Click the "Files" tab to access file management
   - Upload files (images, videos, PDFs, text, markdown)
   - Create folders to organize your files
   - Search and filter files by type
   - Download or delete files as needed

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

### Files Table
```sql
- id: SERIAL PRIMARY KEY
- user_id: INTEGER (Foreign Key to users)
- filename: VARCHAR(255) NOT NULL
- original_filename: VARCHAR(255) NOT NULL
- file_path: VARCHAR(500) NOT NULL (S3 key)
- file_type: VARCHAR(100) NOT NULL
- file_size: BIGINT NOT NULL
- mime_type: VARCHAR(100)
- directory_path: VARCHAR(500) DEFAULT '/'
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Directories Table
```sql
- id: SERIAL PRIMARY KEY
- user_id: INTEGER (Foreign Key to users)
- name: VARCHAR(255) NOT NULL
- path: VARCHAR(500) NOT NULL
- parent_path: VARCHAR(500) DEFAULT '/'
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

### Files
- `GET /api/files` - List files with optional search and filters
- `POST /api/files/upload` - Upload a file to S3
- `GET /api/files/download` - Download a file from S3
- `DELETE /api/files?fileId={fileId}` - Delete a file

### Directories
- `GET /api/directories` - List directories
- `POST /api/directories` - Create a new directory
- `DELETE /api/directories?directoryId={directoryId}` - Delete a directory

## Project Structure

```
memomind/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   └── register/route.ts
│   │   ├── directories/route.ts
│   │   ├── files/
│   │   │   ├── download/route.ts
│   │   │   ├── upload/route.ts
│   │   │   └── route.ts
│   │   └── notes/route.ts
│   ├── components/
│   │   ├── FileManager.tsx
│   │   └── MarkdownEditor.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── notebook/page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── db.ts
│   └── s3.ts
├── scripts/
│   ├── init-db.sql
│   ├── init-db-files.sql
│   └── init-db.js
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
- Files are stored securely in AWS S3 with presigned URLs for downloads
- S3 credentials are stored in environment variables

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running: `pg_isready`
- Check your `.env` credentials
- Verify the database exists: `psql -l`

### S3 Upload/Download Issues
- Verify AWS credentials are correct in `.env`
- Check S3 bucket permissions and CORS configuration
- Ensure the bucket name and region are correct
- Verify IAM user has necessary S3 permissions

### Port Already in Use
- Change the port in `package.json` or kill the process using port 3000

### Module Not Found Errors
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

## Future Enhancements

- [ ] Session-based authentication with JWT
- [ ] Note sharing and collaboration
- [ ] Tags and categories for notes
- [ ] Advanced search functionality
- [ ] Export notes to PDF/HTML
- [ ] Dark mode support
- [ ] Rich text formatting toolbar
- [ ] File preview for images and PDFs
- [ ] Bulk file operations
- [ ] File versioning

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
