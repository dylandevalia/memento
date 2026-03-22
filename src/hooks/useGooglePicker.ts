import { useState } from "react";
import { api } from "../lib/api";

// ── Minimal ambient types for gapi / Google Identity Services ────────────────
declare global {
  interface Window {
    gapi: {
      load: (lib: string, opts: { callback: () => void }) => void;
    };
    google: {
      accounts: {
        oauth2: {
          initCodeClient: (opts: {
            client_id: string;
            scope: string;
            ux_mode: "popup";

            callback: (resp: {
              code?: string;
              error?: string;
              error_description?: string;
            }) => void;
          }) => { requestCode: () => void };
        };
      };
      picker: {
        PickerBuilder: new () => PickerBuilder;
        DocsView: new (viewId?: string) => DocsView;
        ViewId: { FOLDERS: string };
        Action: { PICKED: string };
      };
    };
  }
}

interface PickerBuilder {
  addView(view: DocsView): this;
  setOAuthToken(token: string): this;
  setDeveloperKey(key: string): this;
  setCallback(fn: (data: PickerData) => void): this;
  build(): { setVisible(v: boolean): void };
}

interface DocsView {
  setSelectFolderEnabled(v: boolean): this;
  setMimeTypes(types: string): this;
}

interface PickerData {
  action: string;
  docs: { id: string; name: string }[];
}

export interface PickedFolder {
  id: string;
  name: string;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

interface UseGooglePickerOptions {
  onPicked: (folder: PickedFolder) => void;
}

export function useGooglePicker({ onPicked }: UseGooglePickerOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickFolder() {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch credentials from the server (no env vars needed)
      const creds = await api.config.getGoogle();
      const { clientId, apiKey } = creds;

      if (!clientId || !apiKey) {
        throw new Error(
          "Google credentials are not set up. Fill in the Google Setup section first.",
        );
      }

      // 2. Load Google scripts
      await Promise.all([
        loadScript("https://apis.google.com/js/api.js"),
        loadScript("https://accounts.google.com/gsi/client"),
      ]);

      // 3. Load the Picker library
      await new Promise<void>((resolve) =>
        window.gapi.load("picker", { callback: resolve }),
      );

      // 4. Initiate the authorization code flow (popup).
      //    The server will exchange the code for an access + refresh token.
      const authCode = await new Promise<string>((resolve, reject) => {
        const client = window.google.accounts.oauth2.initCodeClient({
          client_id: clientId,
          scope: [
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/drive.metadata.readonly",
          ].join(" "),
          ux_mode: "popup",
          callback: (resp: {
            code?: string;
            error?: string;
            error_description?: string;
          }) => {
            if (resp.error || !resp.code) {
              reject(
                new Error(
                  resp.error_description ??
                    resp.error ??
                    "Google sign-in was cancelled or failed.",
                ),
              );
            } else {
              resolve(resp.code);
            }
          },
        });
        client.requestCode();
      });

      // 5. Send the code to the server → it stores the refresh token and
      //    returns a short-lived access token we can use for the Picker.
      const { accessToken } = await api.config.exchangeAuthCode(authCode);

      setLoading(false);

      // 6. Open the Drive folder picker
      const view = new window.google.picker.DocsView(
        window.google.picker.ViewId.FOLDERS,
      )
        .setSelectFolderEnabled(true)
        .setMimeTypes("application/vnd.google-apps.folder");

      new window.google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setCallback((data: PickerData) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const doc = data.docs[0];
            if (doc) onPicked({ id: doc.id, name: doc.name });
          }
        })
        .build()
        .setVisible(true);
    } catch (err) {
      setLoading(false);
      setError((err as Error).message);
    }
  }

  return { pickFolder, loading, error };
}
