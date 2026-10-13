import React from 'react';
import { Navbar } from './components/Navbar';
import { DashboardOverview } from './components/Dashboard/DashboardOverview';
import { CardDataTable } from './components/Decks/CardDataTable';
import { StudySessionModal } from './components/StudySession/StudySessionModal';
import { AIGeneratorModal } from './components/AIGenerator/AIGeneratorModal';
import { AICoachModal } from './components/AIGenerator/AICoachModal';
import { CreateDeckModal } from './components/Decks/CreateDeckModal';
import { CardEditorModal } from './components/CardEditor/CardEditorModal';
import { ExportReportModal } from './components/ExportReport/ExportReportModal';
import { ApiKeyModal } from './components/Settings/ApiKeyModal';

import { Deck, Flashcard, ReviewLog, UserStats } from './types';
import {
  getSavedDecks,
  saveDecks,
  getSavedCards,
  saveCards,
  getSavedLogs,
  getSavedUserStats,
  resetToFactoryData,
} from './utils/storage';
import { isCardDue } from './utils/sm2';
import { exportDeckToAnki } from './utils/exportImport';

export function App() {
  // Global Data State
  const [decks, setDecks] = React.useState<Deck[]>(() => getSavedDecks());
  const [cards, setCards] = React.useState<Flashcard[]>(() => getSavedCards());
  const [logs, setLogs] = React.useState<ReviewLog[]>(() => getSavedLogs());
  const [userStats, setUserStats] = React.useState<UserStats>(() => getSavedUserStats());

  // Views & Modals State
  const [currentView, setCurrentView] = React.useState<'dashboard' | 'cards'>('dashboard');
  const [selectedDeckFilter, setSelectedDeckFilter] = React.useState<string | null>(null);

  const [studySession, setStudySession] = React.useState<{
    isOpen: boolean;
    deckTitle: string;
    cards: Flashcard[];
  }>({
    isOpen: false,
    deckTitle: '',
    cards: [],
  });

  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = React.useState(false);
  const [isAICoachOpen, setIsAICoachOpen] = React.useState(false);
  const [isCreateDeckOpen, setIsCreateDeckOpen] = React.useState(false);
  const [isExportReportOpen, setIsExportReportOpen] = React.useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = React.useState(false);

  const [cardEditorState, setCardEditorState] = React.useState<{
    isOpen: boolean;
    card?: Flashcard | null;
    initialDeckId?: string;
  }>({
    isOpen: false,
    card: null,
  });

  // Persist decks & cards on changes
  const updateDecks = (newDecks: Deck[]) => {
    setDecks(newDecks);
    saveDecks(newDecks);
  };

  const updateCards = (newCards: Flashcard[]) => {
    setCards(newCards);
    saveCards(newCards);
  };

  // Due today calculation
  const dueTodayCards = React.useMemo(() => {
    return cards.filter((c) => isCardDue(c));
  }, [cards]);

  // Handler: Start session for all due cards
  const handleStartDueSession = () => {
    const toStudy = dueTodayCards.length > 0 ? dueTodayCards : cards;
    if (toStudy.length === 0) return;

    setStudySession({
      isOpen: true,
      deckTitle: dueTodayCards.length > 0 ? 'Today\'s Due Flashcards' : 'All Flashcards Practice',
      cards: toStudy,
    });
  };

  // Handler: Start session for specific deck
  const handleStartDeckSession = (deckId: string) => {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;

    const deckCards = cards.filter((c) => c.deckId === deckId);
    const dueInDeck = deckCards.filter((c) => isCardDue(c));
    const toStudy = dueInDeck.length > 0 ? dueInDeck : deckCards;

    if (toStudy.length === 0) return;

    setStudySession({
      isOpen: true,
      deckTitle: deck.title,
      cards: toStudy,
    });
  };

  // Handler: Update cards reviewed during study
  const handleUpdateReviewedCards = (reviewed: Flashcard[]) => {
    const reviewedMap = new Map(reviewed.map((c) => [c.id, c]));
    const nextCards = cards.map((c) => reviewedMap.get(c.id) || c);
    updateCards(nextCards);
    // Refresh logs and user stats from storage
    setLogs(getSavedLogs());
    setUserStats(getSavedUserStats());
  };

  // Handlers for Deck Management
  const handleCreateDeck = (newDeck: Deck) => {
    updateDecks([newDeck, ...decks]);
  };

  const handleDeleteDeck = (deckId: string) => {
    updateDecks(decks.filter((d) => d.id !== deckId));
    updateCards(cards.filter((c) => c.deckId !== deckId));
  };

  const handleOpenDeckCards = (deckId: string) => {
    setSelectedDeckFilter(deckId);
    setCurrentView('cards');
  };

  const handleExportDeckQuick = (deck: Deck) => {
    exportDeckToAnki(deck, cards);
  };

  // Handlers for Cards Management
  const handleSaveCard = (cardData: Partial<Flashcard>) => {
    if (cardData.id) {
      // Edit existing
      const nextCards = cards.map((c) =>
        c.id === cardData.id ? ({ ...c, ...cardData } as Flashcard) : c
      );
      updateCards(nextCards);
    } else {
      // Create new
      const newCard: Flashcard = {
        id: `card-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        deckId: cardData.deckId || decks[0]?.id || 'deck-default',
        front: cardData.front || '',
        back: cardData.back || '',
        hint: cardData.hint,
        mnemonic: cardData.mnemonic,
        tags: cardData.tags || ['General'],
        state: 'new',
        repetitions: 0,
        interval: 0,
        easeFactor: 2.5,
        dueDate: new Date().toISOString(),
        lapses: 0,
        createdAt: new Date().toISOString(),
      };
      updateCards([newCard, ...cards]);
    }
  };

  const handleDeleteCard = (cardId: string) => {
    updateCards(cards.filter((c) => c.id !== cardId));
  };

  const handleResetCardSM2 = (cardId: string) => {
    const nextCards = cards.map((c) => {
      if (c.id === cardId) {
        return {
          ...c,
          state: 'new' as const,
          repetitions: 0,
          interval: 0,
          easeFactor: 2.5,
          dueDate: new Date().toISOString(),
        };
      }
      return c;
    });
    updateCards(nextCards);
  };

  const handleBulkDelete = (cardIds: string[]) => {
    const idSet = new Set(cardIds);
    updateCards(cards.filter((c) => !idSet.has(c.id)));
  };

  const handleBulkReset = (cardIds: string[]) => {
    const idSet = new Set(cardIds);
    const nextCards = cards.map((c) => {
      if (idSet.has(c.id)) {
        return {
          ...c,
          state: 'new' as const,
          repetitions: 0,
          interval: 0,
          easeFactor: 2.5,
          dueDate: new Date().toISOString(),
        };
      }
      return c;
    });
    updateCards(nextCards);
  };

  // AI Deck Generator Save
  const handleSaveAIDeckAndCards = (newDeck: Deck, newCards: Flashcard[]) => {
    updateDecks([newDeck, ...decks]);
    updateCards([...newCards, ...cards]);
  };

  const handleAddAICardsToDeck = (deckId: string, newCards: Flashcard[]) => {
    updateCards([...newCards, ...cards]);
  };

  // Import Handler
  const handleImportSuccess = (importedDecks: Deck[], importedCards: Flashcard[]) => {
    const existingDeckIds = new Set(decks.map((d) => d.id));
    const decksToAdd = importedDecks.filter((d) => !existingDeckIds.has(d.id));
    updateDecks([...decks, ...decksToAdd]);
    updateCards([...importedCards, ...cards]);
  };

  // Factory Reset
  const handleResetFactory = () => {
    resetToFactoryData();
    setDecks(getSavedDecks());
    setCards(getSavedCards());
    setLogs([]);
    setUserStats(getSavedUserStats());
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top App Navbar */}
      <Navbar
        stats={userStats}
        dueTodayCount={dueTodayCards.length}
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onOpenCreateDeck={() => setIsCreateDeckOpen(true)}
        onOpenAIGenerator={() => setIsAIGeneratorOpen(true)}
        onOpenAICoach={() => setIsAICoachOpen(true)}
        onOpenExportModal={() => setIsExportReportOpen(true)}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        onStartDueSession={handleStartDueSession}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {currentView === 'dashboard' ? (
          <DashboardOverview
            decks={decks}
            cards={cards}
            userStats={userStats}
            logs={logs}
            onStartDueSession={handleStartDueSession}
            onStartDeckSession={handleStartDeckSession}
            onOpenDeckCards={handleOpenDeckCards}
            onExportDeck={handleExportDeckQuick}
            onDeleteDeck={handleDeleteDeck}
            onOpenAIGenerator={() => setIsAIGeneratorOpen(true)}
            onOpenCreateDeck={() => setIsCreateDeckOpen(true)}
          />
        ) : (
          <div className="space-y-6 pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Flashcard Library & Data Table
                </h1>
                <p className="text-xs text-slate-400">
                  Search, filter, bulk update and schedule your spaced repetition cards
                </p>
              </div>
            </div>

            <CardDataTable
              cards={cards}
              decks={decks}
              selectedDeckId={selectedDeckFilter}
              onSelectDeck={(id) => setSelectedDeckFilter(id)}
              onEditCard={(c) => setCardEditorState({ isOpen: true, card: c })}
              onDeleteCard={handleDeleteCard}
              onResetCardSM2={handleResetCardSM2}
              onBulkDelete={handleBulkDelete}
              onBulkReset={handleBulkReset}
              onAddNewCard={(deckId) =>
                setCardEditorState({ isOpen: true, card: null, initialDeckId: deckId })
              }
              onExportCards={(sel) => {
                if (decks[0]) exportDeckToAnki(decks[0], sel);
              }}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">CogniFlow AI</span>
            <span>—</span>
            <span>Spaced Repetition Flashcard Engine</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <button onClick={() => setIsExportReportOpen(true)} className="hover:text-indigo-400">
              Export / Import
            </button>
            <button onClick={() => setIsApiKeyModalOpen(true)} className="hover:text-indigo-400">
              Gemini Settings
            </button>
            <button onClick={handleResetFactory} className="hover:text-rose-400">
              Reset Demo
            </button>
          </div>
        </div>
      </footer>

      {/* Study Session Full-Screen Modal */}
      {studySession.isOpen && (
        <StudySessionModal
          deckTitle={studySession.deckTitle}
          cards={studySession.cards}
          streakDays={userStats.streakDays}
          onClose={() => setStudySession({ isOpen: false, deckTitle: '', cards: [] })}
          onUpdateCards={handleUpdateReviewedCards}
        />
      )}

      {/* AI Deck Generator Modal */}
      <AIGeneratorModal
        decks={decks}
        isOpen={isAIGeneratorOpen}
        onClose={() => setIsAIGeneratorOpen(false)}
        onSaveDeckAndCards={handleSaveAIDeckAndCards}
        onAddCardsToDeck={handleAddAICardsToDeck}
      />

      {/* AI Study Coach Modal */}
      <AICoachModal
        decks={decks}
        cards={cards}
        userStats={userStats}
        isOpen={isAICoachOpen}
        onClose={() => setIsAICoachOpen(false)}
      />

      {/* Create Deck Modal */}
      <CreateDeckModal
        isOpen={isCreateDeckOpen}
        onClose={() => setIsCreateDeckOpen(false)}
        onCreateDeck={handleCreateDeck}
      />

      {/* Card Editor Modal */}
      <CardEditorModal
        card={cardEditorState.card}
        decks={decks}
        initialDeckId={cardEditorState.initialDeckId}
        isOpen={cardEditorState.isOpen}
        onClose={() => setCardEditorState({ isOpen: false, card: null })}
        onSaveCard={handleSaveCard}
      />

      {/* Export / Import Modal */}
      <ExportReportModal
        decks={decks}
        cards={cards}
        isOpen={isExportReportOpen}
        onClose={() => setIsExportReportOpen(false)}
        onImportSuccess={handleImportSuccess}
        onResetFactoryData={handleResetFactory}
      />

      {/* Gemini API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeySaved={() => {}}
      />
    </div>
  );
}

export default App;
