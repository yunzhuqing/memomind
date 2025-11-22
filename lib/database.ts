import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import { User } from './entities/User';
import { File } from './entities/File';
import { Note } from './entities/Note';
import { Task } from './entities/Task';
import { Directory } from './entities/Directory';

// Database configuration
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'memomind',
  entities: [User, File, Note, Task, Directory],
  synchronize: false, // Don't auto-sync in production
  logging: process.env.NODE_ENV === 'development',
});

// Initialize connection
let isInitialized = false;

async function initializeDatabase() {
  if (!isInitialized) {
    await AppDataSource.initialize();
    isInitialized = true;
    console.log('Database connection initialized');
  }
  return AppDataSource;
}

// Get repository helper
async function getRepository<T extends object>(entity: any): Promise<Repository<T>> {
  const dataSource = await initializeDatabase();
  return dataSource.getRepository(entity) as Repository<T>;
}

// Database operations class
export class Database {
  // User operations
  static async createUser(data: { 
    email: string; 
    password: string; 
    name: string;
    role?: string;
    teamId?: number;
    address?: string;
  }): Promise<User> {
    const repo = await getRepository<User>(User);
    const user = repo.create(data);
    return await repo.save(user);
  }

  static async findUserByEmail(email: string): Promise<User | null> {
    const repo = await getRepository<User>(User);
    return await repo.findOne({ where: { email } });
  }

  static async findUserById(id: number): Promise<User | null> {
    const repo = await getRepository<User>(User);
    return await repo.findOne({ where: { id } });
  }

  static async getAllUsers(): Promise<User[]> {
    const repo = await getRepository<User>(User);
    return await repo.find({
      select: ['id', 'email', 'name', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  static async updateUser(id: number, data: Partial<User>) {
    const repo = await getRepository(User);
    const result = await repo.update(id, data);
    return result.affected ? result.affected > 0 : false;
  }

  static async deleteUser(id: number) {
    const repo = await getRepository(User);
    const result = await repo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  // File operations
  static async createFile(data: Partial<File>): Promise<File> {
    const repo = await getRepository<File>(File);
    const file = repo.create(data);
    return await repo.save(file);
  }

  static async findFileById(id: number, userId: number): Promise<File | null> {
    const repo = await getRepository<File>(File);
    return await repo.findOne({ where: { id, userId } });
  }

  static async findFiles(userId: number, filters?: {
    directoryPath?: string;
    fileType?: string;
    search?: string;
  }): Promise<File[]> {
    const repo = await getRepository<File>(File);
    const query = repo.createQueryBuilder('file')
      .where('file.userId = :userId', { userId });

    if (filters?.directoryPath) {
      query.andWhere('file.directoryPath = :directoryPath', { directoryPath: filters.directoryPath });
    }

    if (filters?.fileType) {
      query.andWhere('file.fileType = :fileType', { fileType: filters.fileType });
    }

    if (filters?.search) {
      query.andWhere('file.originalFilename ILIKE :search', { search: `%${filters.search}%` });
    }

    return await query.orderBy('file.createdAt', 'DESC').getMany();
  }

  static async updateFile(id: number, userId: number, data: Partial<File>) {
    const repo = await getRepository(File);
    const result = await repo.update({ id, userId }, data);
    return result.affected ? result.affected > 0 : false;
  }

  static async deleteFile(id: number, userId: number) {
    const repo = await getRepository(File);
    const result = await repo.delete({ id, userId });
    return result.affected ? result.affected > 0 : false;
  }

  // Note operations
  static async createNote(data: Partial<Note>): Promise<Note> {
    const repo = await getRepository<Note>(Note);
    const note = repo.create(data);
    return await repo.save(note);
  }

  static async findNoteById(id: number, userId: number): Promise<Note | null> {
    const repo = await getRepository<Note>(Note);
    return await repo.findOne({ where: { id, userId } });
  }

  static async findNotes(userId: number, search?: string): Promise<Note[]> {
    const repo = await getRepository<Note>(Note);
    const query = repo.createQueryBuilder('note')
      .where('note.userId = :userId', { userId });

    if (search) {
      query.andWhere('(note.title ILIKE :search OR note.content ILIKE :search)', { search: `%${search}%` });
    }

    return await query.orderBy('note.updatedAt', 'DESC').getMany();
  }

  static async updateNote(id: number, userId: number, data: Partial<Note>) {
    const repo = await getRepository(Note);
    const result = await repo.update({ id, userId }, data);
    return result.affected ? result.affected > 0 : false;
  }

  static async deleteNote(id: number, userId: number) {
    const repo = await getRepository(Note);
    const result = await repo.delete({ id, userId });
    return result.affected ? result.affected > 0 : false;
  }

  // Task operations
  static async createTask(data: Partial<Task>): Promise<Task> {
    const repo = await getRepository<Task>(Task);
    const task = repo.create(data);
    return await repo.save(task);
  }

  static async findTaskById(id: number, userId: number): Promise<Task | null> {
    const repo = await getRepository<Task>(Task);
    return await repo.findOne({ where: { id, userId } });
  }

  static async findTasks(userId: number, filters?: {
    status?: string;
    type?: string;
  }): Promise<Task[]> {
    const repo = await getRepository<Task>(Task);
    const query = repo.createQueryBuilder('task')
      .where('task.userId = :userId', { userId });

    if (filters?.status) {
      query.andWhere('task.status = :status', { status: filters.status });
    }

    if (filters?.type) {
      query.andWhere('task.type = :type', { type: filters.type });
    }

    return await query.orderBy('task.createdAt', 'DESC').getMany();
  }

  static async updateTask(id: number, userId: number, data: Partial<Task>) {
    const repo = await getRepository(Task);
    const result = await repo.update({ id, userId }, data);
    return result.affected ? result.affected > 0 : false;
  }

  static async deleteTask(id: number, userId: number) {
    const repo = await getRepository(Task);
    const result = await repo.delete({ id, userId });
    return result.affected ? result.affected > 0 : false;
  }

  // Directory operations
  static async createDirectory(data: Partial<Directory>): Promise<Directory> {
    const repo = await getRepository<Directory>(Directory);
    const directory = repo.create(data);
    return await repo.save(directory);
  }

  static async findDirectoryById(id: number, userId: number): Promise<Directory | null> {
    const repo = await getRepository<Directory>(Directory);
    return await repo.findOne({ where: { id, userId } });
  }

  static async findDirectories(userId: number, parentPath: string): Promise<Directory[]> {
    const repo = await getRepository<Directory>(Directory);
    return await repo.find({
      where: { userId, parentPath },
      order: { name: 'ASC' },
    });
  }

  static async deleteDirectory(id: number, userId: number) {
    const repo = await getRepository(Directory);
    const result = await repo.delete({ id, userId });
    return result.affected ? result.affected > 0 : false;
  }

  // Close connection (for cleanup)
  static async close() {
    if (isInitialized) {
      await AppDataSource.destroy();
      isInitialized = false;
    }
  }
}

export default Database;
