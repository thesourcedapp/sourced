from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import search, yourcatalogs, catalogpage, username, avatar

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router, tags=["search"])
app.include_router(username.router, tags=["username"])
app.include_router(avatar.router, tags=["avatar"])

@app.get("/")
def root():
    return {"message": "GATE-KEEP API"}