require File.expand_path('../lib/xtee55_clients_importer/version', __FILE__)

Gem::Specification.new do |s|
  s.name = "xtee55_clients_importer"
  s.version = Xtee55ClientsImporter::VERSION
  s.author = "Cybernetica AS"
  s.summary = "Util to import v5 CA clients and groups data to SDSB central"
  s.files = Dir["lib/**/*"] + ["bin/xtee55_clients_importer"]
  s.require_path = "lib"
  s.autorequire = "xtee55_clients_importer"
  s.add_dependency 'activerecord-jdbcpostgresql-adapter'
  s.has_rdoc = false
end
