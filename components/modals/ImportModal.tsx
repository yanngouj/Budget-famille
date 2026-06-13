'use client';

import { useState } from 'react';
import Modal from './Modal';
import { useBudgetStore } from '@/store/useBudgetStore';
import { FileFormat, parseByFormat, getFormatLabel } from '@/lib/parsers';

interface Props {
  open: boolean;
  onClose: () => void;
  pending: { text: string; format: FileFormat; filename: string } | null;
}

export default function ImportModal({ open, onClose, pending }: Props) {
  const [account, setAccount] = useState('CB Yann');
  const { importTransactions, merchantRules } = useBudgetStore();

  function confirm() {
    if (!pending) return;
    const txs = parseByFormat(pending.text, pending.format, account, { ...merchantRules });
    importTransactions(txs);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="📂 Choisir le compte" maxWidth="max-w-lg"
      footer={<>
        <button onClick={onClose} className="btn-secondary">Annuler</button>
        <button onClick={confirm} className="btn-primary">Importer</button>
      </>}
    >
      <p className="text-sm text-slate-400 mb-3">Format détecté : <strong className="text-slate-100">{pending ? getFormatLabel(pending.format) : '—'}</strong></p>
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4 text-xs text-blue-300 leading-relaxed">
        💡 <strong>Colonnes reconnues automatiquement</strong><br />
        Si votre CSV contient une colonne <code>Catégorie</code>, elle sera utilisée directement.<br />
        Les marchands catégorisés seront mémorisés pour les prochains imports.
      </div>
      <p className="text-sm mb-2">Sélectionnez le compte associé à ce fichier :</p>
      <select value={account} onChange={e => setAccount(e.target.value)} className="input-sm w-full text-sm py-2">
        <option value="CB Yann">CB Yann (Fortuneo)</option>
        <option value="CB Chloé">CB Chloé (Fortuneo)</option>
        <option value="Compte commun Fortuneo">Compte commun Fortuneo</option>
        <option value="Compte SG">Compte courant commun SG</option>
      </select>
    </Modal>
  );
}
