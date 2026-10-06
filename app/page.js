import ShowroomApp from '@/components/ShowroomApp';

export default function Page() {
  return (
    <>
      <ShowroomApp />
      <noscript>
        <p className="noscript">This showroom needs JavaScript and WebGL.</p>
      </noscript>
    </>
  );
}
