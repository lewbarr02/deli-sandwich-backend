// setup-globals.js
import { Blob } from 'buffer';
import fetch from 'node-fetch';

globalThis.Blob = Blob;
globalThis.fetch = fetch;
globalThis.Headers = fetch.Headers;
