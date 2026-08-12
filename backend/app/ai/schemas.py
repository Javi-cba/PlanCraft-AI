"""
Pydantic models describing the LLM output.

Every model response is validated against a schema in this module before it
reaches the database. Nothing unvalidated gets persisted.
"""
