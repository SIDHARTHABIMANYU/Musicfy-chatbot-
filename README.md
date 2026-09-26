# Musicfy Chatbot

The conversational AI widget embedded in Musicfy that lets users play music and discover concerts through natural language.

## Problem

Users had no natural-language way to interact with the music platform — searching and browsing required manual clicks, and concert opportunities tied to specific artists were easy to miss.

## Solution

Built a chatbot interface that sends user messages to the Musicfy backend's local LLM (Qwen 2.5:3b via Ollama) for intent understanding, handles commands like "play a random song," "play [song name]," pause/resume, and search, displays concert booking suggestion cards inline when a mapped artist's song plays, and confirms bookings directly in the chat without redirecting the user elsewhere.

## Architecture

User (chat input) → Chatbot Widget → Musicfy Backend (Qwen 2.5:3b via Ollama) → Song playback control + Suggestion Registry (concert cards) + Agent-to-Agent Booking Pipeline (Festora)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | JavaScript |
| AI Backend | Qwen 2.5:3b (via Ollama, on Musicfy's backend) |
| Integration | REST API calls to Musicfy backend |

## Key Features

- Natural-language song search, playback, and control
- Inline concert card suggestions tied to specific songs/artists
- End-to-end booking confirmation without leaving the chat

## Setup

Clone the repo, run: npm install, then npm run dev

## Environment Variables

Requires the backend API URL and API key — see .env.example. None of these are committed to this repository.

## Status

Built and deployed as part of an AI Engineering internship at Spinacle Technologies.
