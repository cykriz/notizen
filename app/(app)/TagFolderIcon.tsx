import { Folder } from 'lucide-react';

// The icon on every row of the tag navigation. Deliberately WITHOUT a distinction between
// "has sub-tags" and "has none": a folder is not a type of its own here, but a tag that
// currently carries sub-tags — the icon would otherwise flip as soon as a sub-tag appears
// somewhere, without anything about the row having changed. An empty folder is a folder in
// Finder too.
//
// The boundary that counts is container against note. Filled and tinted like a macOS
// folder, it sets the sidebar rows apart from the note entries below them, which carry no
// icon at all; in the command palette tag and note mode are never on screen at the same
// time anyway, so there the icon only gives the type of the result list.
// The sr-only label gives screen readers the same hint they could otherwise only see.
//
// One source for sidebar and command palette, so the two do not drift apart.
export function TagFolderIcon() {
  return (
    <>
      <Folder className="shrink-0 fill-current text-primary" />
      <span className="sr-only">Ordner</span>
    </>
  );
}
