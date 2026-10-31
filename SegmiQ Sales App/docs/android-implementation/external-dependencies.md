# Remaining external dependencies

Only items that still block a truthful production behaviour. Services the phone already calls are not listed as missing backend work.

## Security acceptance still required before production writes

`EstateAcceptance` for `https://www.segmiq.com:443`, contract 1, revision `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6`, role `SALESPERSON`, has reads and an empty write set. `privateImageHost` is null. `deployedVerification` is not an attestation.

Each write needs its own sign-off for that origin, revision, contract, capability, and actor. The phone will not treat "the server is deployed" as that sign-off.

Still closed:

1. Viewing schedule, reschedule, and outcome
2. Introduction decisions and new introduction requests
3. Buyer requirement edits
4. Offer decisions
5. Transaction notes
6. Listing create/update and offer create, including concurrency evidence for money writes

## Private listing images

Image delivery was false in the accepted release and `privateImageHost` is null. The phone does not request private image bytes.

## Compliance documents

Case and document routes were not enabled. Protected storage, signed URLs, and MIME/size rules are not accepted for the phone. The screen stays unavailable.

## Recording upload and transcription

Local capture is implemented. There is no authenticated upload or transcription contract on the mobile session, so the app does not offer either.

## Push registration

`GET /api/notifications` is connected. There is no device-token registration contract, so Firebase Cloud Messaging is not registered. The in-app list does not claim push delivery.

## Routes that exist but reject the phone session

These are implemented on the server for a browser cookie session. The Android client uses the bearer session and does not call them, because a 401 would look like a broken action:

- `POST /api/inbox/conversations/{leadId}/transfer-support`
- `GET /api/clients/{org}/leads/{leadId}/real-estate`

Until those routes accept the same bearer session as the rest of the sales app, transfer stays on the web and inquiry relationships are not guessed.

## Attachment send

`POST /api/leads/{leadId}/send-message` accepts text. The phone does not invent an upload.

## Not done in this session

- No authorised account was available, so production reads were not repeated and no production write was attempted.
- No physical Android device was attached. Emulator coverage included a real `MediaRecorder` start, pause, save, and playback. Screen lock, an audio interruption, and a live cellular return were not repeated on hardware.
- The Android tree is untracked in the parent git repository at `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6`. It was not committed onto `main` and was not published.
