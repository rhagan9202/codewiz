import { Button } from "../components/Button";
import { apiClient } from "../api/client";

export default function Home() {
  return <Button label="Browse" onClick={() => { void apiClient.getProducts(); }} />;
}
