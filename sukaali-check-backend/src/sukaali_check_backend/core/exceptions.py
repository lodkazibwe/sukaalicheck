class DomainError(Exception):
    status_code: int = 500
    detail: str = "Internal error"

    def __init__(self, detail: str | None = None):
        if detail:
            self.detail = detail
        super().__init__(self.detail)


class NotFoundError(DomainError):
    status_code = 404
    detail = "Not found"


class ConflictError(DomainError):
    status_code = 409
    detail = "Conflict"


class AuthError(DomainError):
    status_code = 401
    detail = "Unauthorized"


class ForbiddenError(DomainError):
    status_code = 403
    detail = "Forbidden"


class ValidationError(DomainError):
    status_code = 422
    detail = "Validation error"


class PaymentProviderError(DomainError):
    status_code = 502
    detail = "Payment provider error"
