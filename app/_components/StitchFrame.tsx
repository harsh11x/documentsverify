type StitchFrameProps = {
  slug: string;
  title: string;
};

export default function StitchFrame({ slug, title }: StitchFrameProps) {
  return (
    <main style={{ height: "100vh", width: "100vw" }}>
      <iframe
        title={title}
        src={`/stitch/${slug}`}
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
      />
    </main>
  );
}
