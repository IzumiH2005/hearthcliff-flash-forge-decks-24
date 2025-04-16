
import { useState, useEffect } from 'react';
import { getUser } from '@/lib/localStorage';
import { getSessionKey } from '@/lib/sessionManager';
import DeckCard from '@/components/DeckCard';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'react-router-dom';
import { Plus, RefreshCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LoadingState } from '@/components/explore/LoadingState';

const MyDecksPage = () => {
  const [decks, setDecks] = useState([]);
  const [user, setUser] = useState(getUser());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();
  const { toast } = useToast();

  // Fonction pour rafraîchir la liste des decks
  const refreshDecks = async () => {
    setIsLoading(true);
    setError(null);
    const currentUser = getUser();
    setUser(currentUser);
    
    if (!currentUser || !currentUser.id) {
      setIsLoading(false);
      setError("Utilisateur non trouvé");
      return;
    }
    
    try {
      // Utiliser la clé de session comme ID utilisateur si elle existe
      const sessionKey = getSessionKey();
      const userId = sessionKey || currentUser.id;
      
      console.log('Fetching decks for user with ID:', userId);
      
      // Récupérer les decks de l'utilisateur depuis Supabase
      const { data: userDecks, error } = await supabase
        .from('decks')
        .select('*')
        .eq('author_id', userId);
        
      if (error) {
        console.error('Error fetching decks:', error);
        toast({
          title: "Erreur",
          description: "Impossible de charger vos decks",
          variant: "destructive",
        });
        setError("Impossible de charger vos decks");
        setIsLoading(false);
        return;
      }
      
      console.log('Found decks:', userDecks?.length || 0);
      
      // Créer les cartes de deck
      const deckCards = await Promise.all((userDecks || []).map(async (deck) => {
        // Compter les flashcards
        const { count: cardCount } = await supabase
          .from('flashcards')
          .select('*', { count: 'exact', head: true })
          .eq('deck_id', deck.id);
          
        return {
          id: deck.id,
          title: deck.title,
          description: deck.description || "",
          cardCount: cardCount || 0,
          coverImage: deck.cover_image,
          tags: deck.tags || [],
          author: currentUser?.name || 'Utilisateur',
          isPublic: deck.is_public,
        };
      }));
      
      setDecks(deckCards);
      setIsLoading(false);
      
      if (deckCards.length > 0) {
        toast({
          title: "Liste mise à jour",
          description: `${deckCards.length} deck(s) trouvé(s)`,
        });
      }
    } catch (error) {
      console.error('Error in refreshDecks:', error);
      setError("Une erreur est survenue lors du chargement des decks");
      setIsLoading(false);
    }
  };

  // Refresh when navigation happens
  useEffect(() => {
    refreshDecks();
  }, [location.key]); // React to navigation changes

  // Set up realtime subscription for deck changes
  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || !currentUser.id) return;
    
    const sessionKey = getSessionKey();
    const userId = sessionKey || currentUser.id;
    
    const channel = supabase
      .channel('user-decks-changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'decks',
          filter: `author_id=eq.${userId}`
        },
        (payload) => {
          console.log('Deck change detected:', payload);
          refreshDecks();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Mes Decks</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshDecks} disabled={isLoading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {isLoading ? "Chargement..." : "Actualiser"}
          </Button>
          <Button asChild>
            <Link to="/create">
              <Plus className="mr-2 h-4 w-4" />
              Créer un nouveau deck
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground mb-4">
            {error}
          </p>
          <Button onClick={refreshDecks}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Réessayer
          </Button>
        </div>
      ) : decks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            Vous n'avez pas encore créé de decks.
          </p>
          <Button asChild>
            <Link to="/create">
              <Plus className="mr-2 h-4 w-4" />
              Créer votre premier deck
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {decks.map(deck => (
            <DeckCard 
              key={deck.id}
              id={deck.id}
              title={deck.title}
              description={deck.description}
              cardCount={deck.cardCount}
              coverImage={deck.coverImage}
              tags={deck.tags}
              author={user?.name || 'Utilisateur'}
              isPublic={deck.isPublic}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyDecksPage;
