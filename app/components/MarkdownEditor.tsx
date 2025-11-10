'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import 'easymde/dist/easymde.min.css';

// Dynamically import SimpleMDE to avoid SSR issues
const SimpleMDE = dynamic(() => import('react-simplemde-editor'), {
  ssr: false,
});

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export default function MarkdownEditor({ userId }: { userId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    // Load notes from API
    const fetchNotes = async () => {
      try {
        const response = await fetch('/api/notes', {
          headers: {
            'x-user-id': userId,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setNotes(data.notes);
          if (data.notes.length > 0) {
            setCurrentNote(data.notes[0]);
            setContent(data.notes[0].content);
            setTitle(data.notes[0].title);
          }
        }
      } catch (error) {
        console.error('Failed to fetch notes:', error);
      }
    };

    fetchNotes();
  }, [userId]);

  const saveNote = useCallback(async () => {
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    try {
      if (currentNote) {
        // Update existing note
        const response = await fetch('/api/notes', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            id: currentNote.id,
            title,
            content,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const updatedNotes = notes.map((note) =>
            note.id === currentNote.id ? data.note : note
          );
          setNotes(updatedNotes);
          setCurrentNote(data.note);
          alert('Note updated successfully!');
        } else {
          alert('Failed to update note');
        }
      } else {
        // Create new note
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            title,
            content,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const updatedNotes = [data.note, ...notes];
          setNotes(updatedNotes);
          setCurrentNote(data.note);
          alert('Note created successfully!');
        } else {
          alert('Failed to create note');
        }
      }
    } catch (error) {
      console.error('Save note error:', error);
      alert('Failed to save note');
    }
  }, [title, content, currentNote, notes, userId]);

  const createNewNote = useCallback(() => {
    setCurrentNote(null);
    setTitle('');
    setContent('');
  }, []);

  const selectNote = useCallback((note: Note) => {
    setCurrentNote(note);
    setTitle(note.title);
    setContent(note.content);
  }, []);

  const deleteNote = useCallback(async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      const response = await fetch(`/api/notes?id=${noteId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': userId,
        },
      });

      if (response.ok) {
        const updatedNotes = notes.filter((note) => note.id !== noteId);
        setNotes(updatedNotes);

        if (currentNote?.id === noteId) {
          if (updatedNotes.length > 0) {
            setCurrentNote(updatedNotes[0]);
            setTitle(updatedNotes[0].title);
            setContent(updatedNotes[0].content);
          } else {
            setCurrentNote(null);
            setTitle('');
            setContent('');
          }
        }
      } else {
        alert('Failed to delete note');
      }
    } catch (error) {
      console.error('Delete note error:', error);
      alert('Failed to delete note');
    }
  }, [notes, currentNote, userId]);

  const editorOptions = useMemo(() => ({
    spellChecker: false,
    placeholder: 'Start writing your markdown note...',
    status: false,
    toolbar: [
      'bold',
      'italic',
      'heading',
      '|',
      'quote',
      'unordered-list',
      'ordered-list',
      '|',
      'link',
      'image',
      '|',
      'preview',
      'side-by-side',
      'fullscreen',
      '|',
      'guide',
    ] as any,
  }), []);

  const handleContentChange = useCallback((value: string) => {
    setContent(value);
  }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4">
          <button
            onClick={createNewNote}
            className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 mb-4"
          >
            + New Note
          </button>
          <h3 className="text-lg font-semibold mb-2">My Notes</h3>
          <div className="space-y-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`p-3 rounded-md cursor-pointer hover:bg-gray-100 ${
                  currentNote?.id === note.id ? 'bg-indigo-50 border border-indigo-200' : ''
                }`}
              >
                <div onClick={() => selectNote(note)}>
                  <h4 className="font-medium truncate">{note.title}</h4>
                  <p className="text-xs text-gray-500">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNote(note.id);
                  }}
                  className="text-red-500 text-xs mt-1 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 p-4">
          <input
            type="text"
            placeholder="Note Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-2xl font-bold border-none focus:outline-none"
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={saveNote}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
            >
              Save
            </button>
            <button
              onClick={() => setIsPreview(!isPreview)}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
            >
              {isPreview ? 'Edit' : 'Preview'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isPreview ? (
            <div className="prose max-w-none bg-white p-6 rounded-lg shadow">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <SimpleMDE
              value={content}
              onChange={handleContentChange}
              options={editorOptions}
            />
          )}
        </div>
      </div>
    </div>
  );
}
