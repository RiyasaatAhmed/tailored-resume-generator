export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Tailored Resume Generator
      </h1>
      <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        Nothing here yet. The PDF renderer and the database schema are built;
        auth, billing, and the generation pipeline are not.
      </p>
    </main>
  );
}
