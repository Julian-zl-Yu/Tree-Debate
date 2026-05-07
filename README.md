# MapleBoard

TreeDebate monorepo.

## Structure

- `backend/` - Spring Boot API
- `frontend/` - React client

## Development

Backend:

```powershell
cd backend
$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-17.0.16.8-hotspot'
.\mvnw.cmd spring-boot:run
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```
