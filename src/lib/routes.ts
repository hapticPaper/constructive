export function isLibraryPath(pathname: string): boolean {
  return (
    pathname.startsWith('/library') ||
    pathname.startsWith('/channel') ||
    pathname.startsWith('/video')
  );
}
