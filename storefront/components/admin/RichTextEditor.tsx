'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Heading2, Undo, Redo, RemoveFormatting } from 'lucide-react';

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ content, onChange, placeholder = 'Write a product description...' }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `p-1.5 rounded ${active ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`;

  function setLink() {
    const url = window.prompt('URL:', editor?.getAttributes('link').href || '');
    if (url === null) return;
    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive('heading', { level: 2 }))} title="Heading">
          <Heading2 size={16} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))} title="Bold">
          <Bold size={16} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))} title="Italic">
          <Italic size={16} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))} title="Bullet List">
          <List size={16} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))} title="Numbered List">
          <ListOrdered size={16} />
        </button>
        <button type="button" onClick={setLink} className={btnClass(editor.isActive('link'))} title="Link">
          <LinkIcon size={16} />
        </button>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className={btnClass(false)} title="Clear Formatting">
          <RemoveFormatting size={16} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().undo().run()} className={btnClass(false)} title="Undo" disabled={!editor.can().undo()}>
          <Undo size={16} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} className={btnClass(false)} title="Redo" disabled={!editor.can().redo()}>
          <Redo size={16} />
        </button>
      </div>
      <EditorContent editor={editor} className="prose prose-sm max-w-none px-4 py-3 min-h-[120px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[100px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-300 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none" />
    </div>
  );
}
