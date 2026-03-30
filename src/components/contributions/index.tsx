import { useUploadHistory } from "@/hooks/useUploadHistory";
import type { GalleryFile } from "@/types";
import { GalleryViewer } from "../gallery-viewer";
import styles from "./styles.module.css";

interface ContributionsProps {
  slug: string;
}

export function Contributions({ slug }: ContributionsProps) {
  const { history } = useUploadHistory(slug);

  /* Render */

  if (history.length === 0) {
    return null;
  }

  return (
    <section className={styles.contributions}>
      <div className={styles.header}>
        <div />
        <p>your memories</p>
        <div />
      </div>

      <GalleryViewer files={history as GalleryFile[]} />
    </section>
  );
}
