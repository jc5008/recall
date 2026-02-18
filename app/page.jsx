import FlashcardAppClient from "./FlashcardAppClient";
import decks from "../decks";

export default function Home() {
  return <FlashcardAppClient decks={decks} />;
}
