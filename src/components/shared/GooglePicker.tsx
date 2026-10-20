import { useState, useEffect } from "react";
import { toast } from "sonner";
import Script from "next/script";

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface GooglePickerProps {
  onPick: (file: { id: string; url: string; name: string; iconUrl: string }) => void;
  className?: string;
}

export default function GooglePicker({ onPick, className = "" }: GooglePickerProps) {
  const [isReady, setIsReady] = useState(false);
  const [token, setToken] = useState<{ value: string; expiresAt: number } | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  
  // Developer key from env
  const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "";
  const APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID || "";

  useEffect(() => {
    // Check if gapi is loaded
    if (window.gapi) {
      window.gapi.load("picker", { callback: () => setIsReady(true) });
    }
  }, []);

  const handleAuth = async () => {
    try {
      const res = await fetch("/api/integrations/google/token");
      if (!res.ok) {
        throw new Error("Failed to get Google Drive token");
      }
      const data = await res.json();
      // Unknown expiry: assume Google's default 1h lifetime.
      const expiresAt = data.expiresAt ? new Date(data.expiresAt).getTime() : Date.now() + 55 * 60 * 1000;
      setToken({ value: data.accessToken, expiresAt });
      return data.accessToken as string;
    } catch {
      toast.error("Please connect Google Drive in Settings first.");
      return null;
    }
  };

  const createPicker = async () => {
    if (!isReady || !window.google) return;
    setIsPickerOpen(true);

    // Refresh a minute before expiry so the Picker never gets a dead token.
    let accessToken = token && token.expiresAt - Date.now() > 60_000 ? token.value : null;
    if (!accessToken) {
      accessToken = await handleAuth();
      if (!accessToken) {
        setIsPickerOpen(false);
        return;
      }
    }

    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
    view.setIncludeFolders(true);
    
    const picker = new window.google.picker.PickerBuilder()
      .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
      .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
      .setAppId(APP_ID)
      .setOAuthToken(accessToken)
      .addView(view)
      .addView(new window.google.picker.DocsUploadView())
      .setDeveloperKey(API_KEY)
      .setCallback(async (data: any) => {
        if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
          const doc = data[window.google.picker.Response.DOCUMENTS][0];
          
          // Set file to anyone with link can view (so other users in the system can see the thumbnail)
          fetch("/api/integrations/google/share", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileId: doc.id })
          })
            .then((res) => {
              if (!res.ok) toast.error("Couldn't share this file with your team. Others may not be able to open it.");
            })
            .catch(console.error);

          onPick({
            id: doc.id,
            url: doc.url,
            name: doc.name,
            iconUrl: doc.iconUrl,
          });
        }
        if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.CANCEL || 
            data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
          setIsPickerOpen(false);
        }
      })
      .build();
    
    picker.setVisible(true);
  };

  return (
    <>
      <Script 
        src="https://apis.google.com/js/api.js" 
        onLoad={() => {
          if (window.gapi) {
            window.gapi.load("picker", { callback: () => setIsReady(true) });
          }
        }}
      />
      <button
        type="button"
        onClick={createPicker}
        disabled={!isReady || isPickerOpen}
        className={`px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-semibold flex items-center gap-2 transition-colors ${className} ${(!isReady || isPickerOpen) ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <i className="ph-fill ph-google-drive-logo text-lg"></i>
        Pick from Drive
      </button>
    </>
  );
}
