# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copia tudo do backend (context já é backend/Petshop.Api)
COPY . .

# Restaura, builda e publica
RUN dotnet restore "./Petshop.Api.csproj"
RUN dotnet publish "./Petshop.Api.csproj" -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish .

# Render injeta a env PORT. Vamos escutar nela.
ENV ASPNETCORE_URLS=http://0.0.0.0:${PORT}

# Render costuma usar 10000, mas não precisa fixar.
EXPOSE 10000

ENTRYPOINT ["dotnet", "Petshop.Api.dll"]