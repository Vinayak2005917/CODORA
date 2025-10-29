"""
Project storage utilities for CODORA.
Manages filesystem-based project storage with room numbers.
"""
import json
import os
import random
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, List
from django.conf import settings


class ProjectStore:
    """Handles project creation, retrieval, and management."""
    
    def __init__(self):
        self.projects_root = settings.BASE_DIR / "projects"
        self.projects_root.mkdir(exist_ok=True)
    
    def generate_room(self) -> str:
        """Generate a unique 6-digit room number."""
        max_attempts = 100
        for _ in range(max_attempts):
            room = str(random.randint(100000, 999999))
            if not self.room_exists(room):
                return room
        raise RuntimeError("Failed to generate unique room number")
    
    def room_exists(self, room: str) -> bool:
        """Check if a room already exists."""
        room_path = self.projects_root / room
        return room_path.exists()
    
    def get_project_path(self, room: str) -> Path:
        """Get the path to a project's directory."""
        return self.projects_root / room
    
    def extract_preview(self, content: str, max_length: int = 300) -> str:
        """Extract a preview from content (first few lines/chars)."""
        # Remove markdown formatting for preview
        preview = content.replace('#', '').replace('*', '').replace('`', '')
        lines = preview.split('\n')
        preview_text = ' '.join(line.strip() for line in lines if line.strip())
        
        if len(preview_text) > max_length:
            preview_text = preview_text[:max_length] + "..."
        
        return preview_text
    
    def get_content_filename(self, project_type: str) -> str:
        """Get the appropriate content filename based on project type."""
        return {
            'doc': 'content.md',
            'code': 'main.txt',
            'lesson': 'lesson.md'
        }.get(project_type, 'content.txt')
    
    def create_project(self, project_type: str, prompt: str, content: str, title: Optional[str] = None) -> Dict:
        """
        Create a new project with a unique room number.
        
        Args:
            project_type: 'doc', 'code', or 'lesson'
            prompt: Original user prompt
            content: AI-generated or initial content
            title: Optional title (defaults to first line of content or prompt)
        
        Returns:
            Dict with room, path, type, and other metadata
        """
        print(f"DEBUG: Creating project with type={project_type}, prompt length={len(prompt)}")
        room = self.generate_room()
        print(f"DEBUG: Generated room: {room}")
        room_path = self.get_project_path(room)
        print(f"DEBUG: Room path: {room_path}")
        room_path.mkdir(parents=True, exist_ok=True)
        print(f"DEBUG: Created directory: {room_path.exists()}")
        
        # Generate title if not provided
        if not title:
            # Try to extract from content (first line without markdown)
            first_line = content.split('\n')[0].strip()
            title = first_line.replace('#', '').strip()[:50]
            if not title:
                title = prompt[:50] if prompt else f"Project {room}"
        
        print(f"DEBUG: Generated title: {title}")
        
        # Create metadata
        now = datetime.utcnow().isoformat()
        meta = {
            'room': room,
            'type': project_type,
            'title': title,
            'prompt': prompt,
            'created_at': now,
            'updated_at': now,
            'preview': self.extract_preview(content)
        }
        
        # Save metadata
        meta_path = room_path / 'meta.json'
        print(f"DEBUG: Saving meta to: {meta_path}")
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
        
        # Save content
        content_filename = self.get_content_filename(project_type)
        content_path = room_path / content_filename
        print(f"DEBUG: Saving content to: {content_path}")
        with open(content_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"DEBUG: Project created successfully: {room}")
        return {
            'room': room,
            'type': project_type,
            'title': title,
            'path': str(room_path),
            'created_at': now,
            'updated_at': now
        }
    
    def get_project(self, room: str) -> Optional[Dict]:
        """
        Get a project's metadata and content.
        
        Returns:
            Dict with metadata and content, or None if not found
        """
        room_path = self.get_project_path(room)
        if not room_path.exists():
            return None
        
        meta_path = room_path / 'meta.json'
        if not meta_path.exists():
            return None
        
        # Load metadata
        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)
        
        # Load content
        content_filename = self.get_content_filename(meta.get('type', 'doc'))
        content_path = room_path / content_filename
        
        content = ""
        if content_path.exists():
            with open(content_path, 'r', encoding='utf-8') as f:
                content = f.read()
        
        return {
            **meta,
            'content': content
        }
    
    def list_projects(self) -> List[Dict]:
        """
        List all projects.
        
        Returns:
            List of project metadata dicts (without full content)
        """
        projects = []
        
        if not self.projects_root.exists():
            return projects
        
        for room_dir in self.projects_root.iterdir():
            if not room_dir.is_dir():
                continue
            
            meta_path = room_dir / 'meta.json'
            if not meta_path.exists():
                continue
            
            try:
                with open(meta_path, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                    projects.append(meta)
            except (json.JSONDecodeError, IOError):
                continue
        
        # Sort by updated_at descending (most recent first)
        projects.sort(key=lambda p: p.get('updated_at', ''), reverse=True)
        
        return projects
    
    def save_content(self, room: str, content: str) -> bool:
        """
        Save content to a project.
        
        Returns:
            True if successful, False if project doesn't exist
        """
        room_path = self.get_project_path(room)
        if not room_path.exists():
            return False
        
        meta_path = room_path / 'meta.json'
        if not meta_path.exists():
            return False
        
        # Load metadata to get type
        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)

        # Save content
        content_filename = self.get_content_filename(meta.get('type', 'doc'))
        content_path = room_path / content_filename

        with open(content_path, 'w', encoding='utf-8') as f:
            f.write(content)

        # Update metadata timestamp and preview (UTC)
        meta['updated_at'] = datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()
        meta['preview'] = self.extract_preview(content)

        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)

        return True

    # ---------------- Versioning ----------------
    def _versions_dir(self, room: str):
        room_path = self.get_project_path(room)
        versions_path = room_path / 'versions'
        versions_path.mkdir(parents=True, exist_ok=True)
        return versions_path

    def save_version(self, room: str, content: str, message: str, author: str = 'User') -> Optional[Dict]:
        """
        Save a snapshot/version of the project's content.

        Returns version metadata dict or None if room doesn't exist.
        """
        room_path = self.get_project_path(room)
        if not room_path.exists():
            return None

        versions_path = self._versions_dir(room)
        now = datetime.utcnow().replace(tzinfo=timezone.utc)
        timestamp = now.isoformat()  # includes timezone offset
        # Filename: YYYYmmddHHMMSS_micro.json to keep ordering
        filename = now.strftime('%Y%m%d%H%M%S%f') + '.json'
        version_path = versions_path / filename

        version_data = {
            'id': filename.replace('.json', ''),
            'room': room,
            'message': message,
            'author': author,
            'timestamp': timestamp,
            'content': content
        }

        with open(version_path, 'w', encoding='utf-8') as f:
            json.dump(version_data, f, indent=2, ensure_ascii=False)

        # Update project's updated_at and preview
        self.save_content(room, content)

        return version_data

    def list_versions(self, room: str) -> Optional[List[Dict]]:
        """List saved versions for a project, most recent first."""
        room_path = self.get_project_path(room)
        if not room_path.exists():
            return None

        versions_path = room_path / 'versions'
        if not versions_path.exists():
            return []

        versions = []
        for vfile in versions_path.iterdir():
            if not vfile.is_file() or not vfile.name.endswith('.json'):
                continue
            try:
                with open(vfile, 'r', encoding='utf-8') as f:
                    v = json.load(f)
                    versions.append(v)
            except Exception:
                continue

        # Sort by id (timestamp) descending
        versions.sort(key=lambda x: x.get('id', ''), reverse=True)
        return versions

    def get_version(self, room: str, version_id: str) -> Optional[Dict]:
        """Retrieve a specific version by id (filename without .json)."""
        versions_path = self.get_project_path(room) / 'versions'
        if not versions_path.exists():
            return None

        vfile = versions_path / (version_id + '.json')
        if not vfile.exists():
            return None

        try:
            with open(vfile, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return None

    def delete_project(self, room: str) -> bool:
        """Delete an entire project directory. Returns True if deleted, False otherwise."""
        project_path = self.get_project_path(room)
        if not project_path.exists():
            return False
        
        try:
            import shutil
            shutil.rmtree(project_path)
            return True
        except Exception:
            return False

    def delete_version(self, room: str, version_id: str) -> bool:
        """Delete a version file. Returns True if deleted, False otherwise."""
        versions_path = self.get_project_path(room) / 'versions'
        if not versions_path.exists():
            print(f"delete_version: versions directory does not exist: {versions_path}")
            return False

        vfile = versions_path / (version_id + '.json')
        if not vfile.exists():
            print(f"delete_version: file not found: {vfile}")
            return False

        try:
            # Attempt to unlink the file and log any error for easier debugging
            try:
                vfile.unlink()
                print(f"delete_version: deleted file: {vfile}")
                return True
            except Exception as e:
                # Windows may lock files; surface the error for debugging
                print(f"delete_version: failed to delete {vfile}: {e}")
                return False
        except Exception:
            # This outer except is kept as a safeguard, but inner unlink handles errors.
            print(f"delete_version: unexpected error when deleting {vfile}")
            return False


# Singleton instance
project_store = ProjectStore()
