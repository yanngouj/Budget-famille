'use client';

import { useEffect, useState } from 'react';
import { useBudgetStore } from '@/store/useBudgetStore';
import { detectFormat, parseByFormat, guessAccountFromFilename, readFileAsText, readFileAsArrayBuffer, parseXLSXtoCSV, FileFormat } from '@/lib/parsers';

interface Props {
  onNeedAccount: (text: string, format: FileFormat, filename: string) => void;
}

export default function DropZone({ onNeedAccount }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const { importTransactions, merchantRules } = useBudgetStore();

  useEffect(() => {
    async function processFiles(files: FileList) {
      for (const file of Array.from(files)) {
        const name = file.name.toLowerCase();
        if (name.endsWith('.csv')) {
          const text = await readFileAsText(file);
          const lines = text.split(/\r?\n/);
          const headerLine = lines.find(l => /date|libell/i.test(l) && l.includes(';')) || lines[0] || '';
          const sep = headerLine.includes(';') ? ';' : ',';
          const headers = headerLine.split(sep).map(x => (x || '').trim());
          const fmt = detectFormat(headers);
          const account = guessAccountFromFilename(file.name);
          if (account) {
            importTransactions(parseByFormat(text, fmt, account, { ...merchantRules }));
          } else {
            onNeedAccount(text, fmt, file.name);
          }
        } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
          const buf = await readFileAsArrayBuffer(file);
          onNeedAccount(parseXLSXtoCSV(buf), 'generic', file.name);
        }
      }
    }

    function onDragEnter(e: DragEvent) {
      if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); setIsDragging(true); }
    }
    function onDragLeave(e: DragEvent) {
      if (!e.relatedTarget) setIsDragging(false);
    }
    function onDragOver(e: DragEvent) { e.preventDefault(); }
    function onDrop(e: DragEvent) {
      e.preventDefault(); setIsDragging(false);
      if (e.dataTransfer?.files) processFiles(e.dataTransfer.files);
    }

    document.addEventListener('dragenter', onDragEnter);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('dragenter', onDragEnter);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
    };
  }, [merchantRules]);

  if (!isDragging) return null;
  return (
    <div className="fixed inset-0 bg-[#0F172A]/92 z-50 flex items-center justify-center">
      <div className="border-4 border-dashed border-blue-500 rounded-2xl px-20 py-12 text-center text-blue-400">
        <div className="text-6xl mb-3">📂</div>
        <div className="text-xl font-bold">Déposez vos fichiers ici</div>
        <div className="text-sm text-slate-400 mt-1.5">CSV Fortuneo / SG — Excel accepté</div>
      </div>
    </div>
  );
}
