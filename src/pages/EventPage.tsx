import { CircularProgress } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Contributions } from "@/components/contributions";
import { FileUpload } from "@/components/file-upload";
import { PageHeader } from "@/components/page-header";
import { QrModal } from "@/components/qr-modal";
import { api } from "@/lib/api";
import { TIMEOUTS } from "@/lib/constants";
import { handleError } from "@/lib/errorHandler";
import type { ValidateTokenResponse } from "@/types";
import styles from "./styles.module.css";

export function EventPage() {
  const { slug } = useParams<{ slug: string }>();

  const [eventInfo, setEventInfo] = useState<ValidateTokenResponse["event"]>();
  const [eventValid, setEventValid] = useState<boolean | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const handleOpenQr = useCallback(() => {
    setQrOpen(true);
  }, []);

  useEffect(() => {
    if (!slug) {
      console.error("No slug provided in URL");
      setEventValid(false);
      return;
    }

    async function validateSlug(slug: string) {
      try {
        const res = await api.events.validate(slug);
        await new Promise((r) => setTimeout(r, TIMEOUTS.VALIDATION_DELAY_MS)); // Artificial delay for better UX
        if (!res.valid) throw new Error(res.error || "Invalid slug");

        setEventInfo(res.event);
        setEventValid(true);
      } catch (error) {
        handleError(error, "EventPage:validateSlug");
        setEventValid(false);
      }
    }

    validateSlug(slug);
  }, [slug]);

  if (eventValid === null) {
    return (
      <article className={styles.uploadPage}>
        <PageHeader />
        <main>
          <CircularProgress />
          <p>Loading event data...</p>
        </main>
      </article>
    );
  } else if (!slug || eventValid === false || !eventInfo) {
    return (
      <article className={styles.uploadPage}>
        <PageHeader />

        <main>
          <p>Invalid or expired event link</p>
        </main>
      </article>
    );
  }

  return (
    <article className={styles.uploadPage}>
      <PageHeader handleOpenQr={handleOpenQr} />

      <h1>{eventInfo.name.toLocaleLowerCase()}</h1>

      <main>
        <FileUpload slug={slug} handleOpenQr={handleOpenQr} />

        <Contributions slug={slug} />
      </main>

      <QrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        slug={slug}
        eventName={eventInfo.name}
      />
    </article>
  );
}
