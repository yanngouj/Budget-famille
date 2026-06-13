'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import Charts from '@/components/Charts';
import TransactionTable from '@/components/TransactionTable';
import Prevision from '@/components/Prevision';
import DropZone from '@/components/DropZone';
import ReviewModal from '@/components/modals/ReviewModal';
import ImportModal from '@/components/modals/ImportModal';
import VIModal from '@/components/modals/VIModal';
import RecatModal from '@/components/modals/RecatModal';
import { FileFormat } from '@/lib/parsers';

interface PendingImport {
  text: string;
  format: FileFormat;
  filename: string;
}

export default function Page() {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [viOpen, setViOpen] = useState(false);
  const [recatOpen, setRecatOpen] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);

  function handleNeedAccount(text: string, format: FileFormat, filename: string) {
    setPending({ text, format, filename });
  }

  return (
    <div className="min-h-screen" style={{ background: '#0F172A' }}>
      <Header
        onOpenReview={() => setReviewOpen(true)}
        onOpenVI={() => setViOpen(true)}
        onOpenRecat={() => setRecatOpen(true)}
        onOpenImport={handleNeedAccount}
      />
      <FilterBar />

      <main className="px-5 py-4">
        <Prevision />
        <Charts />
        <TransactionTable />
      </main>

      <DropZone onNeedAccount={handleNeedAccount} />
      <ReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} />
      <ImportModal open={!!pending} onClose={() => setPending(null)} pending={pending} />
      <VIModal open={viOpen} onClose={() => setViOpen(false)} />
      <RecatModal open={recatOpen} onClose={() => setRecatOpen(false)} />
    </div>
  );
}
